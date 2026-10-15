using ClimbingApp.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimbingApp.Api.Data.Configurations;

public class HoldConfiguration : IEntityTypeConfiguration<Hold>
{
    public void Configure(EntityTypeBuilder<Hold> e)
    {
        e.ToTable("holds");
        e.HasKey(x => x.Id);
        e.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        e.Property(x => x.BoardId).HasColumnName("board_id");
        e.Property(x => x.XCenter).HasColumnName("x_center");
        e.Property(x => x.YCenter).HasColumnName("y_center");
        e.Property(x => x.Width).HasColumnName("width");
        e.Property(x => x.Height).HasColumnName("height");
        e.Property(x => x.Confidence).HasColumnName("confidence");
        e.Property(x => x.CreatedAt).HasColumnName("created_at").ValueGeneratedNever();
        e.HasIndex(x => x.BoardId).HasDatabaseName("idx_holds_board_id");
    }
}
