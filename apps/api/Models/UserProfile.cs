namespace ClimbingApp.Api.Models;

public class UserProfile
{
    public string Id { get; set; } = "";
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public Guid? DefaultBoardId { get; set; }
}
