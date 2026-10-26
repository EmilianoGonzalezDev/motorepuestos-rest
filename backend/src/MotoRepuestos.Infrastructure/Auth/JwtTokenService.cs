using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "MotoRepuestos.Api";
    public string Audience { get; set; } = "MotoRepuestos.Web";

    /// <summary>HMAC-SHA256 signing key, at least 32 bytes. Must come from secrets/env vars outside development.</summary>
    public string SigningKey { get; set; } = string.Empty;

    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;

    public SymmetricSecurityKey GetSecurityKey() => new(Encoding.UTF8.GetBytes(SigningKey));
}

internal sealed class JwtTokenService(IOptions<JwtOptions> options, TimeProvider clock) : ITokenService
{
    private readonly JwtOptions _options = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    public AccessToken CreateAccessToken(User user)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var expires = now.AddMinutes(_options.AccessTokenMinutes);

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = expires,
            Subject = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Name, user.FullName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                new Claim("role", user.Role.ToString())
            ]),
            SigningCredentials = new SigningCredentials(_options.GetSecurityKey(), SecurityAlgorithms.HmacSha256)
        };

        return new AccessToken(_handler.CreateToken(descriptor), expires);
    }

    public GeneratedRefreshToken CreateRefreshToken()
    {
        var raw = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));
        return new GeneratedRefreshToken(raw, HashRefreshToken(raw),
            clock.GetUtcNow().UtcDateTime.AddDays(_options.RefreshTokenDays));
    }

    public string HashRefreshToken(string rawToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}

internal sealed class PasswordHasherAdapter : Application.Abstractions.IPasswordHasher
{
    private readonly Microsoft.AspNetCore.Identity.PasswordHasher<User> _inner = new();

    public string Hash(User user, string password) => _inner.HashPassword(user, password);

    public bool Verify(User user, string hashedPassword, string providedPassword) =>
        _inner.VerifyHashedPassword(user, hashedPassword, providedPassword)
            is Microsoft.AspNetCore.Identity.PasswordVerificationResult.Success
            or Microsoft.AspNetCore.Identity.PasswordVerificationResult.SuccessRehashNeeded;
}
