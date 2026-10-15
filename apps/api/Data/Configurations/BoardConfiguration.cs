using ClimbingApp.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimbingApp.Api.Data.Configurations;

public class BoardConfiguration : IEntityTypeConfiguration<Board>
{
    public void Configure(EntityTypeBuilder<Board> e)
    {
        e.ToTable("boards");
        e.HasKey(x => x.Id);
        e.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        e.Property(x => x.Name).HasColumnName("name").IsRequired();
        e.Property(x => x.ImageUrl).HasColumnName("image_url");
        e.Property(x => x.UserId).HasColumnName("user_id");
        e.Property(x => x.ImageWidth).HasColumnName("image_width");
        e.Property(x => x.ImageHeight).HasColumnName("image_height");
        e.Property(x => x.CreatedAt).HasColumnName("created_at").ValueGeneratedNever();
        e.HasIndex(x => x.UserId).HasDatabaseName("idx_boards_user_id");
        e.HasMany(x => x.Holds).WithOne(h => h.Board!).HasForeignKey(h => h.BoardId).OnDelete(DeleteBehavior.Cascade);
    }
}
