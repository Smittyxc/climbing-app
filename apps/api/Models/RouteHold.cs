namespace ClimbingApp.Api.Models;

public class RouteHold
{
    public Guid RouteId { get; set; }
    public Guid HoldId { get; set; }
    public HoldType? Type { get; set; }

    public ClimbRoute Route { get; set; } = null!;
    public Hold Hold { get; set; } = null!;
}
