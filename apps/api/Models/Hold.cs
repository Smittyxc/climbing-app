namespace ClimbingApp.Api.Models;

public class Hold
{
    public Guid Id { get; set; }
    public Guid? BoardId { get; set; }
    /// <summary>Normalized (0..1) center X of the bounding box.</summary>
    public double XCenter { get; set; }
    public double YCenter { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public double? Confidence { get; set; }
    public DateTime CreatedAt { get; set; }

    public Board? Board { get; set; }
    public ICollection<RouteHold> RouteHolds { get; set; } = new List<RouteHold>();
}
