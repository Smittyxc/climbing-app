using ClimbingApp.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimbingApp.Api.Data.Configurations;

public class UserProfileConfiguration : IEntityTypeConfiguration<UserProfile>
{
    public void Configure(EntityTypeBuilder<UserProfile> e)
    {
        e.ToTable("users");
        e.HasKey(x => x.Id);
        e.Property(x => x.Id).HasColumnName("id");
        e.Property(x => x.Email).HasColumnName("email");
        e.Property(x => x.FirstName).HasColumnName("first_name");
        e.Property(x => x.LastName).HasColumnName("last_name");
        e.Property(x => x.DefaultBoardId).HasColumnName("default_board_id");
        // Null the default board when its board is deleted (matches the original schema).
        e.HasOne<Board>()
            .WithMany()
            .HasForeignKey(x => x.DefaultBoardId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("fk_users_boards_default_board_id");
    }
}
