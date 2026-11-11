using ClimbingApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ClimbingApp.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Board> Boards => Set<Board>();
    public DbSet<Hold> Holds => Set<Hold>();
    public DbSet<ClimbRoute> Routes => Set<ClimbRoute>();
    public DbSet<RouteHold> RouteHolds => Set<RouteHold>();
    public DbSet<UserProfile> Users => Set<UserProfile>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
