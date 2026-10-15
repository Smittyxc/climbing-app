using ClimbingApp.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimbingApp.Api.Data.Configurations;

public class RouteHoldConfiguration : IEntityTypeConfiguration<RouteHold>
{
    public void Configure(EntityTypeBuilder<RouteHold> e)
    {
        e.ToTable("route_holds");
        e.HasKey(x => new { x.RouteId, x.HoldId });
        e.Property(x => x.RouteId).HasColumnName("route_id");
        e.Property(x => x.HoldId).HasColumnName("hold_id");
        e.Property(x => x.Type)
            .HasColumnName("type")
            .HasConversion(
                v => v.HasValue ? v.Value.ToString().ToLowerInvariant() : null,
                v => string.IsNullOrWhiteSpace(v) ? (HoldType?)null : Enum.Parse<HoldType>(v!, true));
        e.HasOne(x => x.Hold)
            .WithMany(h => h.RouteHolds)
            .HasForeignKey(x => x.HoldId)
            .OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => x.RouteId).HasDatabaseName("idx_route_holds_route");
    }
}
