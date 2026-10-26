using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Users;

namespace MotoRepuestos.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Policy = Policies.Staff)]
public sealed class UsersController(UserAdminService userService) : ControllerBase
{
    [HttpGet]
    public async Task<PagedResponse<UserAdminDto>> List([FromQuery] UserListQuery query, CancellationToken ct) =>
        await userService.ListAsync(query, ct);

    /// <summary>Creates an administrator account (super admin only).</summary>
    [HttpPost("admins")]
    [Authorize(Policy = Policies.SuperAdmin)]
    [ProducesResponseType<UserAdminDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserAdminDto>> CreateAdmin(CreateAdminRequest request, CancellationToken ct)
    {
        var result = await userService.CreateAdminAsync(request, ct);
        return result.IsSuccess ? Created($"/api/users/{result.Value.Id}", result.Value) : this.ToProblem(result.Error!);
    }

    /// <summary>Enables/disables an account; disabling revokes its sessions (super admin only).</summary>
    [HttpPatch("{id:int}/status")]
    [Authorize(Policy = Policies.SuperAdmin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetStatus(int id, SetUserStatusRequest request, CancellationToken ct) =>
        this.ToNoContent(await userService.SetStatusAsync(id, request.IsActive, ct));
}
