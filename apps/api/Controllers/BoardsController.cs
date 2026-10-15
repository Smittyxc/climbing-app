using ClimbingApp.Api.Auth;
using ClimbingApp.Api.Dtos;
using ClimbingApp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ClimbingApp.Api.Controllers;

[ApiController]
[Route("api/boards")]
public class BoardsController : ControllerBase
{
    private readonly IBoardService _boards;

    public BoardsController(IBoardService boards) => _boards = boards;

    [HttpGet]
    public async Task<ActionResult<List<BoardDto>>> GetAll(CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        return Ok(await _boards.GetBoardsAsync(uid, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BoardDto>> GetById(Guid id, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        var board = await _boards.GetBoardAsync(uid, id, ct);
        return board is null ? NotFound() : Ok(board);
    }

    [HttpPost]
    [RequestSizeLimit(25_000_000)]
    public async Task<ActionResult<BoardDto>> Upload(
        [FromForm] string name,
        [FromForm] IFormFile image,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("A board name is required.");
        }
        if (image is null || image.Length == 0)
        {
            return BadRequest("An image file is required.");
        }

        var uid = HttpContext.GetUserId();
        var board = await _boards.CreateFromUploadAsync(uid, name.Trim(), image, ct);
        return CreatedAtAction(nameof(GetById), new { id = board.Id }, board);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var uid = HttpContext.GetUserId();
        return await _boards.DeleteAsync(uid, id, ct) ? NoContent() : NotFound();
    }
}
