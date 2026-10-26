using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Features.Account;
using MotoRepuestos.Application.Features.Auth;

namespace MotoRepuestos.Api.Controllers;

[ApiController]
[Route("api/account")]
[Authorize]
public sealed class AccountController(AccountService accountService) : ControllerBase
{
    [HttpGet("profile")]
    public async Task<ActionResult<UserDto>> GetProfile(CancellationToken ct) =>
        this.ToActionResult(await accountService.GetProfileAsync(ct));

    [HttpPut("profile")]
    [ProducesResponseType<UserDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserDto>> UpdateProfile(UpdateProfileRequest request, CancellationToken ct) =>
        this.ToActionResult(await accountService.UpdateProfileAsync(request, ct));

    /// <summary>Changes the password and signs out every other session.</summary>
    [HttpPut("password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct) =>
        this.ToNoContent(await accountService.ChangePasswordAsync(request, RefreshTokenCookie.Read(Request), ct));
}
