using ClimbingApp.Api.Auth;
using ClimbingApp.Api.Dtos;
using ClimbingApp.Api.Models;
using ClimbingApp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ClimbingApp.Api.Controllers;

[ApiController]
[Route("api/user")]
public class UserController : ControllerBase
{
    private readonly UserService _users;

    public UserController(UserService users) => _users = users;

    [HttpGet]
    public async Task<ActionResult<UserProfile>> Get(CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        var profile = await _users.GetOrCreateAsync(uid, HttpContext.GetUserEmail(), ct);
        return Ok(profile);
    }

    [HttpPatch]
    public async Task<ActionResult<UserProfile>> Patch([FromBody] UpdateUserRequest request, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        await _users.UpdateDefaultBoardAsync(uid, request.DefaultBoardId, ct);
        var profile = await _users.GetOrCreateAsync(uid, HttpContext.GetUserEmail(), ct);
        return Ok(profile);
    }
}
