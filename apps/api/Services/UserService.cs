using ClimbingApp.Api.Data;
using ClimbingApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ClimbingApp.Api.Services;

public class UserService
{
    private readonly AppDbContext _db;

    public UserService(AppDbContext db) => _db = db;

    /// <summary>
    /// Returns the local profile row for a Firebase user, creating it on first login.
    /// Replaces Supabase's handle_new_user() trigger.
    /// </summary>
    public async Task<UserProfile> GetOrCreateAsync(string uid, string? email, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == uid, ct);
        if (user is null)
        {
            user = new UserProfile { Id = uid, Email = email };
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);
            return user;
        }

        if (!string.IsNullOrEmpty(email) && user.Email != email)
        {
            user.Email = email;
            await _db.SaveChangesAsync(ct);
        }
        return user;
    }

    public async Task UpdateDefaultBoardAsync(string uid, Guid? boardId, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == uid, ct);
        if (user is null)
        {
            user = new UserProfile { Id = uid };
            _db.Users.Add(user);
        }

        if (boardId is not null)
        {
            var owns = await _db.Boards.AnyAsync(b => b.Id == boardId && b.UserId == uid, ct);
            if (!owns)
            {
                throw new UnauthorizedAccessException("That board does not belong to you.");
            }
        }

        user.DefaultBoardId = boardId;
        await _db.SaveChangesAsync(ct);
    }
}
