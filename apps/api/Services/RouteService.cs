using ClimbingApp.Api.Data;
using ClimbingApp.Api.Dtos;
using ClimbingApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ClimbingApp.Api.Services;

public interface IRouteService
{
    Task<List<RouteDto>> GetRoutesAsync(string uid, CancellationToken ct);
    Task<RouteDto?> GetRouteAsync(string uid, Guid id, CancellationToken ct);
    Task<List<RouteHoldDto>?> GetRouteHoldsAsync(string uid, Guid routeId, CancellationToken ct);
    Task<List<CompleteRouteHoldDto>?> GetCompleteRouteAsync(string uid, Guid routeId, CancellationToken ct);
    Task<RouteDto> CreateAsync(string uid, CreateRouteRequest request, CancellationToken ct);
    Task<bool> UpdateAsync(string uid, Guid id, UpdateRouteRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(string uid, Guid id, CancellationToken ct);
    Task DeleteHoldsAsync(string uid, Guid routeId, CancellationToken ct);
    Task AddHoldsAsync(string uid, Guid routeId, IEnumerable<RouteHoldInput> holds, CancellationToken ct);
}

public class RouteService : IRouteService
{
    private readonly AppDbContext _db;

    public RouteService(AppDbContext db) => _db = db;

    public async Task<List<RouteDto>> GetRoutesAsync(string uid, CancellationToken ct)
    {
        var routes = await _db.Routes
            .Where(r => r.UserId == uid)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        return routes.Select(ToDto).ToList();
    }

    public async Task<RouteDto?> GetRouteAsync(string uid, Guid id, CancellationToken ct)
    {
        var route = await _db.Routes.FirstOrDefaultAsync(r => r.Id == id && r.UserId == uid, ct);
        return route is null ? null : ToDto(route);
    }

    public async Task<List<RouteHoldDto>?> GetRouteHoldsAsync(string uid, Guid routeId, CancellationToken ct)
    {
        if (!await OwnsRouteAsync(uid, routeId, ct)) return null;

        var rows = await _db.RouteHolds
            .Where(rh => rh.RouteId == routeId)
            .ToListAsync(ct);

        return rows.Select(rh => new RouteHoldDto
        {
            RouteId = rh.RouteId,
            HoldId = rh.HoldId,
            Type = TypeToString(rh.Type),
        }).ToList();
    }

    public async Task<List<CompleteRouteHoldDto>?> GetCompleteRouteAsync(string uid, Guid routeId, CancellationToken ct)
    {
        if (!await OwnsRouteAsync(uid, routeId, ct)) return null;

        var rows = await _db.RouteHolds
            .Include(rh => rh.Hold)
            .Where(rh => rh.RouteId == routeId)
            .ToListAsync(ct);

        return rows.Select(rh => new CompleteRouteHoldDto
        {
            RouteId = rh.RouteId,
            HoldId = rh.HoldId,
            Type = TypeToString(rh.Type),
            Hold = rh.Hold.ToDto(),
        }).ToList();
    }

    public async Task<RouteDto> CreateAsync(string uid, CreateRouteRequest request, CancellationToken ct)
    {
        var ownsBoard = await _db.Boards.AnyAsync(b => b.Id == request.BoardId && b.UserId == uid, ct);
        if (!ownsBoard)
        {
            throw new UnauthorizedAccessException("That board does not belong to you.");
        }

        var route = new Route
        {
            Id = Guid.NewGuid(),
            BoardId = request.BoardId,
            UserId = uid,
            Name = request.Name,
            Grade = request.Grade,
            CreatedAt = DateTime.UtcNow,
        };

        _db.Routes.Add(route);
        await _db.SaveChangesAsync(ct);
        return ToDto(route);
    }

    public async Task<bool> UpdateAsync(string uid, Guid id, UpdateRouteRequest request, CancellationToken ct)
    {
        var route = await _db.Routes.FirstOrDefaultAsync(r => r.Id == id && r.UserId == uid, ct);
        if (route is null) return false;

        route.Name = request.Name;
        route.Grade = request.Grade;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteAsync(string uid, Guid id, CancellationToken ct)
    {
        var route = await _db.Routes.FirstOrDefaultAsync(r => r.Id == id && r.UserId == uid, ct);
        if (route is null) return false;

        _db.Routes.Remove(route);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task DeleteHoldsAsync(string uid, Guid routeId, CancellationToken ct)
    {
        if (!await OwnsRouteAsync(uid, routeId, ct))
        {
            throw new UnauthorizedAccessException("That route does not belong to you.");
        }

        var rows = await _db.RouteHolds.Where(rh => rh.RouteId == routeId).ToListAsync(ct);
        _db.RouteHolds.RemoveRange(rows);
        await _db.SaveChangesAsync(ct);
    }

    public async Task AddHoldsAsync(string uid, Guid routeId, IEnumerable<RouteHoldInput> holds, CancellationToken ct)
    {
        if (!await OwnsRouteAsync(uid, routeId, ct))
        {
            throw new UnauthorizedAccessException("That route does not belong to you.");
        }

        var rows = holds.Select(h => new RouteHold
        {
            RouteId = routeId,
            HoldId = h.HoldId,
            Type = ParseType(h.Type),
        });

        _db.RouteHolds.AddRange(rows);
        await _db.SaveChangesAsync(ct);
    }

    private Task<bool> OwnsRouteAsync(string uid, Guid routeId, CancellationToken ct)
        => _db.Routes.AnyAsync(r => r.Id == routeId && r.UserId == uid, ct);

    private static HoldType? ParseType(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : Enum.Parse<HoldType>(value, true);

    private static string? TypeToString(HoldType? type)
        => type.HasValue ? type.Value.ToString().ToLowerInvariant() : null;

    private static RouteDto ToDto(Route r) => new()
    {
        Id = r.Id,
        BoardId = r.BoardId,
        UserId = r.UserId,
        Name = r.Name,
        Grade = r.Grade,
        CreatedAt = r.CreatedAt,
    };
}
