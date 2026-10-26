using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Auth;
using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Application.Features.Users;

public sealed record UserListQuery(int? Page, int? PageSize, string? Search, UserRole? Role, bool? IsActive);

public sealed record UserAdminDto(
    int Id,
    string FullName,
    string Email,
    UserRole Role,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt,
    int OrdersCount);

public sealed record CreateAdminRequest(string FullName, string Email, string Password);

public sealed record SetUserStatusRequest(bool IsActive);

public sealed class CreateAdminRequestValidator : AbstractValidator<CreateAdminRequest>
{
    public CreateAdminRequestValidator()
    {
        RuleFor(x => x.FullName).ValidFullName();
        RuleFor(x => x.Email).ValidEmail();
        RuleFor(x => x.Password).StrongPassword();
    }
}

public sealed class UserAdminService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPasswordHasher passwordHasher,
    TimeProvider clock,
    IValidator<CreateAdminRequest> createAdminValidator)
{
    public async Task<PagedResponse<UserAdminDto>> ListAsync(UserListQuery query, CancellationToken ct = default)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize);
        var users = db.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            users = users.Where(u => u.FullName.ToLower().Contains(term) || u.Email.Contains(term));
        }

        if (query.Role is { } role) users = users.Where(u => u.Role == role);
        if (query.IsActive is { } isActive) users = users.Where(u => u.IsActive == isActive);

        return await users
            .OrderByDescending(u => u.Role)
            .ThenBy(u => u.FullName)
            .Select(u => new UserAdminDto(
                u.Id,
                u.FullName,
                u.Email,
                u.Role,
                u.IsActive,
                u.CreatedAt,
                u.LastLoginAt,
                db.Orders.Count(o => o.UserId == u.Id)))
            .ToPagedAsync(page, pageSize, ct);
    }

    public async Task<Result<UserAdminDto>> CreateAdminAsync(CreateAdminRequest request, CancellationToken ct = default)
    {
        if (await createAdminValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        var email = User.NormalizeEmail(request.Email);
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
            return Error.Conflict("auth.email_taken", "La dirección de email ya se encuentra registrada.");

        var user = User.Create(request.FullName, email, UserRole.Admin);
        user.SetPasswordHash(passwordHasher.Hash(user, request.Password));
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        return new UserAdminDto(user.Id, user.FullName, user.Email, user.Role, user.IsActive, user.CreatedAt, null, 0);
    }

    /// <summary>Enables/disables an account. Disabling also revokes its sessions.</summary>
    public async Task<Result> SetStatusAsync(int userId, bool isActive, CancellationToken ct = default)
    {
        if (userId == currentUser.UserId)
            return Error.Conflict("user.self_status", "No podés cambiar el estado de tu propia cuenta.");

        var user = await db.Users.Include(u => u.RefreshTokens).FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Error.NotFound("user.not_found", "Usuario no encontrado.");

        if (isActive)
        {
            user.Activate();
        }
        else
        {
            user.Deactivate();
            user.RevokeAllRefreshTokens(clock.GetUtcNow().UtcDateTime);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
