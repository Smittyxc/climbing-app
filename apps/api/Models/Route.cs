namespace ClimbingApp.Api.Models;

public class Route
{
    public Guid Id { get; set; }
    public Guid? BoardId { get; set; }
    public string? UserId { get; set; }
    public string Name { get; set; } = "";
    public string? Grade { get; set; }
    public DateTime? CreatedAt { get; set; }

    public Board? Board { get; set; }
    public ICollection<RouteHold> RouteHolds { get; set; } = new List<RouteHold>();
}
