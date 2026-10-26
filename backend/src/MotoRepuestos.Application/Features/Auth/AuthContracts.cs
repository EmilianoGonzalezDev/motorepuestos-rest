using FluentValidation;
using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Application.Features.Auth;

public sealed record RegisterRequest(string FullName, string Email, string Password);

public sealed record LoginRequest(string Email, string Password);

public sealed record UserDto(int Id, string FullName, string Email, UserRole Role);

/// <summary>
/// Result of a successful authentication. The refresh token travels back to the browser in an
/// HttpOnly cookie (set by the API), never in the JSON body.
/// </summary>
public sealed record AuthResult(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    UserDto User,
    string RefreshToken,
    DateTime RefreshTokenExpiresAt);

internal static class PasswordRules
{
    public const int MinLength = 8;
    public const int MaxLength = 100;

    public static IRuleBuilderOptions<T, string> StrongPassword<T>(this IRuleBuilder<T, string> rule) =>
        rule
            .NotEmpty().WithMessage("Ingresá una contraseña.")
            .MinimumLength(MinLength).WithMessage($"La contraseña debe tener al menos {MinLength} caracteres.")
            .MaximumLength(MaxLength).WithMessage($"La contraseña no puede superar los {MaxLength} caracteres.")
            .Matches("[A-Za-z]").WithMessage("La contraseña debe incluir al menos una letra.")
            .Matches("[0-9]").WithMessage("La contraseña debe incluir al menos un número.");
}

internal static class UserRules
{
    public static IRuleBuilderOptions<T, string> ValidFullName<T>(this IRuleBuilder<T, string> rule) =>
        rule
            .NotEmpty().WithMessage("Ingresá tu nombre completo.")
            .MaximumLength(User.FullNameMaxLength).WithMessage($"El nombre no puede superar los {User.FullNameMaxLength} caracteres.");

    public static IRuleBuilderOptions<T, string> ValidEmail<T>(this IRuleBuilder<T, string> rule) =>
        rule
            .NotEmpty().WithMessage("Ingresá un email.")
            .EmailAddress().WithMessage("El email no es válido.")
            .MaximumLength(User.EmailMaxLength).WithMessage($"El email no puede superar los {User.EmailMaxLength} caracteres.");
}

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.FullName).ValidFullName();
        RuleFor(x => x.Email).ValidEmail();
        RuleFor(x => x.Password).StrongPassword();
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("Ingresá tu email.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Ingresá tu contraseña.");
    }
}
