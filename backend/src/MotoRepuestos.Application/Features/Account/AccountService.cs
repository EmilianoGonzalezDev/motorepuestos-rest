using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Auth;
using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Application.Features.Account;

public sealed record UpdateProfileRequest(string FullName, string Email);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.FullName).ValidFullName();
        RuleFor(x => x.Email).ValidEmail();
    }
}

public sealed class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty().WithMessage("Ingresá tu contraseña actual.");
        RuleFor(x => x.NewPassword).StrongPassword()
            .NotEqual(x => x.CurrentPassword).WithMessage("La nueva contraseña debe ser distinta de la actual.");
    }
}

public sealed class AccountService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPasswordHasher passwordHasher,
    ITokenService tokenService,
    TimeProvider clock,
    IValidator<UpdateProfileRequest> profileValidator,
    IValidator<ChangePasswordRequest> passwordValidator)
{
    public async Task<Result<UserDto>> GetProfileAsync(CancellationToken ct = default)
    {
        var user = await FindCurrentUserAsync(includeTokens: false, ct);
        return user is null ? UserNotFound() : user.ToDto();
    }

    public async Task<Result<UserDto>> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken ct = default)
    {
        if (await profileValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        var user = await FindCurrentUserAsync(includeTokens: false, ct);
        if (user is null) return UserNotFound();

        var email = User.NormalizeEmail(request.Email);
        if (email != user.Email && await db.Users.AnyAsync(u => u.Email == email && u.Id != user.Id, ct))
            return Error.Conflict("auth.email_taken", "La dirección de email ya se encuentra registrada.");

        user.UpdateProfile(request.FullName, email);
        await db.SaveChangesAsync(ct);
        return user.ToDto();
    }

    /// <summary>
    /// Changes the password and closes every other session (refresh tokens), keeping the current one alive.
    /// </summary>
    public async Task<Result> ChangePasswordAsync(
        ChangePasswordRequest request, string? currentRefreshToken, CancellationToken ct = default)
    {
        if (await passwordValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        var user = await FindCurrentUserAsync(includeTokens: true, ct);
        if (user is null) return UserNotFound();

        if (!passwordHasher.Verify(user, user.PasswordHash, request.CurrentPassword))
            return Error.Validation("account.wrong_password", "La contraseña actual es incorrecta.",
                new Dictionary<string, string[]> { ["currentPassword"] = ["La contraseña actual es incorrecta."] });

        user.SetPasswordHash(passwordHasher.Hash(user, request.NewPassword));

        var now = clock.GetUtcNow().UtcDateTime;
        var keepHash = string.IsNullOrWhiteSpace(currentRefreshToken) ? null : tokenService.HashRefreshToken(currentRefreshToken);
        foreach (var token in user.RefreshTokens.Where(t => t.RevokedAt is null && t.TokenHash != keepHash))
            token.Revoke(now, replacedByTokenHash: null);

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<User?> FindCurrentUserAsync(bool includeTokens, CancellationToken ct)
    {
        if (currentUser.UserId is not int userId) return null;

        var query = db.Users.AsQueryable();
        if (includeTokens) query = query.Include(u => u.RefreshTokens);
        return await query.FirstOrDefaultAsync(u => u.Id == userId, ct);
    }

    private static Error UserNotFound() => Error.NotFound("user.not_found", "Usuario no encontrado.");
}
