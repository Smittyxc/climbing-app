using ClimbingApp.Api.Dtos;
using ClimbingApp.Api.Models;

namespace ClimbingApp.Api.Services;

public static class Mapping
{
    public static HoldDto ToDto(this Hold h) => new()
    {
        Id = h.Id,
        BoardId = h.BoardId ?? Guid.Empty,
        XCenter = h.XCenter,
        YCenter = h.YCenter,
        Width = h.Width,
        Height = h.Height,
        Confidence = h.Confidence,
    };
}
