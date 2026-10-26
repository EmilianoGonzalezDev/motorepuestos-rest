using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Features.Auth;

namespace MotoRepuestos.Api.Controllers;

public sealed record AuthResponse(string AccessToken, DateTime ExpiresAt, UserDto User);

[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public sealed class AuthController(AuthService authService, IConfiguration configuration) : ControllerBase
{
    private bool SecureCookies => configuration.GetValue("Auth:SecureCookies", true);

    /// <summary>Registers a customer account and signs it in.</summary>
    [HttpPost("register")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken ct)
    {
        var result = await authService.RegisterAsync(request, ct);
        if (result.IsFailure) return this.ToProblem(result.Error!);

        return Created("/api/account/profile", SignIn(result.Value));
    }

    [HttpPost("login")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var result = await authService.LoginAsync(request, ct);
        return result.IsSuccess ? Ok(SignIn(result.Value)) : this.ToProblem(result.Error!);
    }

    /// <summary>Issues a new access token using the HttpOnly refresh cookie (rotated on every call).</summary>
    [HttpPost("refresh")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken ct)
    {
        var result = await authService.RefreshAsync(RefreshTokenCookie.Read(Request), ct);
        if (result.IsSuccess) return Ok(SignIn(result.Value));

        RefreshTokenCookie.Delete(Response, SecureCookies);
        return this.ToProblem(result.Error!);
    }

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await authService.LogoutAsync(RefreshTokenCookie.Read(Request), ct);
        RefreshTokenCookie.Delete(Response, SecureCookies);
        return NoContent();
    }

    private AuthResponse SignIn(AuthResult auth)
    {
        RefreshTokenCookie.Append(Response, auth.RefreshToken, auth.RefreshTokenExpiresAt, SecureCookies);
        return new AuthResponse(auth.AccessToken, auth.AccessTokenExpiresAt, auth.User);
    }
}
