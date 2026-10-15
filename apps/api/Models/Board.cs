namespace ClimbingApp.Api.Models;

public class Board
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    /// <summary>GCS object name. The API returns a signed URL in responses.</summary>
    public string? ImageUrl { get; set; }
    public string? UserId { get; set; }
    public int? ImageWidth { get; set; }
    public int? ImageHeight { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<Hold> Holds { get; set; } = new List<Hold>();
    public ICollection<Route> Routes { get; set; } = new List<Route>();
}
