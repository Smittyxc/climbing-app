using ClimbingApp.Api.Data;
using ClimbingApp.Api.Dtos;
using ClimbingApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ClimbingApp.Api.Services;

public interface IBoardService
{
    Task<List<BoardDto>> GetBoardsAsync(string uid, CancellationToken ct);
    Task<BoardDto?> GetBoardAsync(string uid, Guid id, CancellationToken ct);
    Task<BoardDto> CreateFromUploadAsync(string uid, string name, IFormFile image, CancellationToken ct);
    Task<bool> DeleteAsync(string uid, Guid id, CancellationToken ct);
}

public class BoardService : IBoardService
{
    private readonly TimeSpan _urlTtl;

    private readonly AppDbContext _db;
    private readonly IStorageService _storage;
    private readonly IDetectorClient _detector;

    public BoardService(AppDbContext db, IStorageService storage, IDetectorClient detector, IConfiguration config)
    {
        _db = db;
        _storage = storage;
        _detector = detector;
        var minutes = int.TryParse(config["SIGNED_URL_TTL_MINUTES"], out var m) ? m : 60;
        _urlTtl = TimeSpan.FromMinutes(minutes);
    }

    public async Task<List<BoardDto>> GetBoardsAsync(string uid, CancellationToken ct)
    {
        var boards = await _db.Boards
            .Where(b => b.UserId == uid)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(ct);

        return boards.Select(b => ToDto(b, includeHolds: false)).ToList();
    }

    public async Task<BoardDto?> GetBoardAsync(string uid, Guid id, CancellationToken ct)
    {
        var board = await _db.Boards
            .Include(b => b.Holds)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == uid, ct);

        return board is null ? null : ToDto(board, includeHolds: true);
    }

    public async Task<BoardDto> CreateFromUploadAsync(string uid, string name, IFormFile image, CancellationToken ct)
    {
        var extension = Path.GetExtension(image.FileName);
        var objectName = $"boards/{Guid.NewGuid():N}{extension}";
        var contentType = string.IsNullOrWhiteSpace(image.ContentType)
            ? "application/octet-stream"
            : image.ContentType;

        await using var buffer = new MemoryStream();
        await image.CopyToAsync(buffer, ct);

        await _storage.UploadAsync(objectName, buffer, contentType, ct);

        DetectionResult detection;
        try
        {
            buffer.Position = 0;
            detection = await _detector.DetectAsync(buffer, image.FileName, contentType, ct);
        }
        catch
        {
            await _storage.DeleteAsync(objectName, ct);
            throw;
        }

        var board = new Board
        {
            Id = Guid.NewGuid(),
            Name = name,
            ImageUrl = objectName,
            UserId = uid,
            ImageWidth = detection.ImageWidth,
            ImageHeight = detection.ImageHeight,
            CreatedAt = DateTime.UtcNow,
            Holds = detection.Holds.Select(h => new Hold
            {
                Id = Guid.NewGuid(),
                XCenter = h.XCenter,
                YCenter = h.YCenter,
                Width = h.Width,
                Height = h.Height,
                Confidence = h.Confidence,
                CreatedAt = DateTime.UtcNow,
            }).ToList(),
        };

        _db.Boards.Add(board);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch
        {
            await _storage.DeleteAsync(objectName, ct);
            throw;
        }

        return ToDto(board, includeHolds: true);
    }

    public async Task<bool> DeleteAsync(string uid, Guid id, CancellationToken ct)
    {
        var board = await _db.Boards.FirstOrDefaultAsync(b => b.Id == id && b.UserId == uid, ct);
        if (board is null) return false;

        var objectName = board.ImageUrl;
        _db.Boards.Remove(board);
        await _db.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(objectName))
        {
            await _storage.DeleteAsync(objectName, ct);
        }
        return true;
    }

    private string? Sign(string? objectName)
        => objectName is null ? null : (_storage.TryGetSignedUrl(objectName, _urlTtl) ?? _storage.PublicUrl(objectName));

    private BoardDto ToDto(Board b, bool includeHolds) => new()
    {
        Id = b.Id,
        Name = b.Name,
        ImageUrl = Sign(b.ImageUrl),
        UserId = b.UserId,
        ImageWidth = b.ImageWidth,
        ImageHeight = b.ImageHeight,
        CreatedAt = b.CreatedAt,
        Holds = includeHolds ? b.Holds.Select(h => h.ToDto()).ToList() : null,
    };
}
