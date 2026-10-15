namespace ClimbingApp.Api.Dtos;

public class HoldDto
{
    public Guid Id { get; set; }
    public Guid BoardId { get; set; }
    public double XCenter { get; set; }
    public double YCenter { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public double? Confidence { get; set; }
}

public class BoardDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? ImageUrl { get; set; }
    public string? UserId { get; set; }
    public int? ImageWidth { get; set; }
    public int? ImageHeight { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<HoldDto>? Holds { get; set; }
}

public class RouteDto
{
    public Guid Id { get; set; }
    public Guid? BoardId { get; set; }
    public string? UserId { get; set; }
    public string Name { get; set; } = "";
    public string? Grade { get; set; }
    public DateTime? CreatedAt { get; set; }
}

public class RouteHoldDto
{
    public Guid RouteId { get; set; }
    public Guid HoldId { get; set; }
    public string? Type { get; set; }
}

public class CompleteRouteHoldDto
{
    public Guid RouteId { get; set; }
    public Guid HoldId { get; set; }
    public string? Type { get; set; }
    public HoldDto Hold { get; set; } = new();
}

public class CreateRouteRequest
{
    public Guid BoardId { get; set; }
    public string Name { get; set; } = "";
    public string? Grade { get; set; }
}

public class UpdateRouteRequest
{
    public string Name { get; set; } = "";
    public string? Grade { get; set; }
}

public class RouteHoldInput
{
    public Guid HoldId { get; set; }
    public string? Type { get; set; }
}

public class AddRouteHoldsRequest
{
    public List<RouteHoldInput> Holds { get; set; } = new();
}

public class UpdateUserRequest
{
    public Guid? DefaultBoardId { get; set; }
}

public class DetectedHold
{
    public double XCenter { get; set; }
    public double YCenter { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public double? Confidence { get; set; }
}

public class DetectionResult
{
    public int ImageWidth { get; set; }
    public int ImageHeight { get; set; }
    public string? Mode { get; set; }
    public List<DetectedHold> Holds { get; set; } = new();
}
