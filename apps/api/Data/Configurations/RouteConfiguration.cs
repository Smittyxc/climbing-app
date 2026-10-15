using ClimbingApp.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimbingApp.Api.Data.Configurations;

public class RouteConfiguration : IEntityTypeConfiguration<Route>
{
    public void Configure(EntityTypeBuilder<Route> e)
    {
        e.ToTable("routes");
        e.HasKey(x => x.Id);
        e.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        e.Property(x => x.BoardId).HasColumnName("board_id");
        e.Property(x => x.UserId).HasColumnName("user_id");
        e.Property(x => x.Name).HasColumnName("name").IsRequired();
        e.Property(x => x.Grade).HasColumnName("grade");
        e.Property(x => x.CreatedAt).HasColumnName("created_at").ValueGeneratedNever();
        e.HasIndex(x => x.UserId).HasDatabaseName("idx_routes_user_id");
        e.HasIndex(x => x.BoardId).HasDatabaseName("idx_routes_board_id");
        e.HasMany(x => x.RouteHolds)
            .WithOne(rh => rh.Route)
            .HasForeignKey(rh => rh.RouteId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
