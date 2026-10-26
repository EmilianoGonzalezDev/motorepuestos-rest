using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Application.Features.Auth;

public sealed class AuthService(
    IAppDbContext db,
    IPasswordHasher passwordHasher,
    ITokenService tokenService,
    ICurrentUser currentUser,
    TimeProvider clock,
    IValidator<RegisterRequest> registerValidator,
    IValidator<LoginRequest> loginValidator,
    ILogger<AuthService> logger)
{
    private static readonly TimeSpan TokenRetention = TimeSpan.FromDays(30);

    private static readonly Error InvalidCredentials =
        Error.Unauthorized("auth.invalid_credentials", "Email o contraseña incorrectos.");

    private static readonly Error InvalidRefreshToken =
        Error.Unauthorized("auth.invalid_refresh_token", "La sesión expiró. Volvé a iniciar sesión.");

    public async Task<Result<AuthResult>> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        if (await registerValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        var email = User.NormalizeEmail(request.Email);
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
            return Error.Conflict("auth.email_taken", "La dirección de email ya se encuentra registrada.");

        var user = User.Create(request.FullName, email, UserRole.Client);
        user.SetPasswordHash(passwordHasher.Hash(user, request.Password));
        db.Users.Add(user);

        // Save first: the access token needs the database-generated user id as its subject.
        await db.SaveChangesAsync(ct);
        user.RecordLogin(clock.GetUtcNow().UtcDateTime);
        var result = IssueTokens(user);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("New customer registered: {UserId}", user.Id);
        return result;
    }

    public async Task<Result<AuthResult>> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        if (await loginValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users
            .Include(u => u.RefreshTokens)
            .FirstOrDefaultAsync(u => u.Email == email, ct);

        if (user is null || !passwordHasher.Verify(user, user.PasswordHash, request.Password))
        {
            logger.LogWarning("Failed login attempt for {Email}", email);
            return InvalidCredentials;
        }

        if (!user.IsActive)
            return Error.Forbidden("auth.user_disabled", "Tu cuenta está deshabilitada. Contactá a la tienda.");

        var now = clock.GetUtcNow().UtcDateTime;
        user.RecordLogin(now);
        user.PruneRefreshTokens(now, TokenRetention);

        var result = IssueTokens(user);
        await db.SaveChangesAsync(ct);
        return result;
    }

    /// <summary>
    /// Rotates the refresh token. If a token that was already rotated is presented again it was
    /// probably stolen, so every session of that user is revoked.
    /// </summary>
    public async Task<Result<AuthResult>> RefreshAsync(string? rawRefreshToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawRefreshToken))
            return InvalidRefreshToken;

        var hash = tokenService.HashRefreshToken(rawRefreshToken);
        var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null)
            return InvalidRefreshToken;

        var user = await db.Users
            .Include(u => u.RefreshTokens)
            .FirstAsync(u => u.Id == token.UserId, ct);

        var now = clock.GetUtcNow().UtcDateTime;

        if (token.RevokedAt is not null)
        {
            logger.LogWarning("Refresh token reuse detected for user {UserId}; revoking all sessions", user.Id);
            user.RevokeAllRefreshTokens(now);
            await db.SaveChangesAsync(ct);
            return InvalidRefreshToken;
        }

        if (!token.IsActive(now) || !user.IsActive)
            return InvalidRefreshToken;

        var result = IssueTokens(user, rotated: token);
        await db.SaveChangesAsync(ct);
        return result;
    }

    public async Task LogoutAsync(string? rawRefreshToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawRefreshToken)) return;

        var hash = tokenService.HashRefreshToken(rawRefreshToken);
        var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null) return;

        token.Revoke(clock.GetUtcNow().UtcDateTime, replacedByTokenHash: null);
        await db.SaveChangesAsync(ct);
    }

    private AuthResult IssueTokens(User user, RefreshToken? rotated = null)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var access = tokenService.CreateAccessToken(user);
        var refresh = tokenService.CreateRefreshToken();

        rotated?.Revoke(now, refresh.TokenHash);
        user.AddRefreshToken(refresh.TokenHash, refresh.ExpiresAt, now, currentUser.IpAddress);

        return new AuthResult(
            access.Token,
            access.ExpiresAt,
            user.ToDto(),
            refresh.RawToken,
            refresh.ExpiresAt);
    }
}

public static class UserMappings
{
    public static UserDto ToDto(this User user) => new(user.Id, user.FullName, user.Email, user.Role);
}
