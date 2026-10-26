using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Application.Abstractions;

/// <summary>The authenticated caller, resolved from the JWT claims.</summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    int? UserId { get; }
    UserRole? Role { get; }
    bool IsStaff { get; }
    string? IpAddress { get; }

    /// <summary>Guest cart id sent by the SPA in the X-Cart-Id header.</summary>
    Guid? GuestCartId { get; }
}

public interface IPasswordHasher
{
    string Hash(User user, string password);
    bool Verify(User user, string hashedPassword, string providedPassword);
}

public sealed record AccessToken(string Token, DateTime ExpiresAt);

public sealed record GeneratedRefreshToken(string RawToken, string TokenHash, DateTime ExpiresAt);

public interface ITokenService
{
    AccessToken CreateAccessToken(User user);
    GeneratedRefreshToken CreateRefreshToken();
    string HashRefreshToken(string rawToken);
}

public interface IImageStorage
{
    /// <summary>Stores the image and returns the generated file name.</summary>
    Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken = default);
    void Delete(string fileName);

    /// <summary>False when storing <paramref name="bytes"/> more would exceed the configured quota.</summary>
    bool HasRoomFor(long bytes);
}

public interface IRichTextSanitizer
{
    string Sanitize(string html);
}
