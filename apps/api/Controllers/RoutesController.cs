using ClimbingApp.Api.Auth;
using ClimbingApp.Api.Dtos;
using ClimbingApp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ClimbingApp.Api.Controllers;

[ApiController]
[Route("api/routes")]
public class RoutesController : ControllerBase
{
    private readonly IRouteService _routes;

    public RoutesController(IRouteService routes) => _routes = routes;

    [HttpGet]
    public async Task<ActionResult<List<RouteDto>>> GetAll(CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        return Ok(await _routes.GetRoutesAsync(uid, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<RouteDto>> GetById(Guid id, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        var route = await _routes.GetRouteAsync(uid, id, ct);
        return route is null ? NotFound() : Ok(route);
    }

    [HttpGet("{id:guid}/holds")]
    public async Task<ActionResult<List<RouteHoldDto>>> GetHolds(Guid id, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        var holds = await _routes.GetRouteHoldsAsync(uid, id, ct);
        return holds is null ? NotFound() : Ok(holds);
    }

    [HttpGet("{id:guid}/complete")]
    public async Task<ActionResult<List<CompleteRouteHoldDto>>> GetComplete(Guid id, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        var holds = await _routes.GetCompleteRouteAsync(uid, id, ct);
        return holds is null ? NotFound() : Ok(holds);
    }

    [HttpPost]
    public async Task<ActionResult<RouteDto>> Create([FromBody] CreateRouteRequest request, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        var route = await _routes.CreateAsync(uid, request, ct);
        return CreatedAtAction(nameof(GetById), new { id = route.Id }, route);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<RouteDto>> Update(Guid id, [FromBody] UpdateRouteRequest request, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        if (!await _routes.UpdateAsync(uid, id, request, ct)) return NotFound();
        return Ok(await _routes.GetRouteAsync(uid, id, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        return await _routes.DeleteAsync(uid, id, ct) ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/holds")]
    public async Task<IActionResult> AddHolds(Guid id, [FromBody] AddRouteHoldsRequest request, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        await _routes.AddHoldsAsync(uid, id, request.Holds, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}/holds")]
    public async Task<IActionResult> DeleteHolds(Guid id, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        await _routes.DeleteHoldsAsync(uid, id, ct);
        return NoContent();
    }
}
