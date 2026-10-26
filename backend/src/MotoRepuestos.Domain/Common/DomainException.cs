namespace MotoRepuestos.Domain.Common;

/// <summary>
/// Raised when an operation would break a business invariant (e.g. selling more units than in stock).
/// The API translates it into a 409/422 ProblemDetails response.
/// </summary>
public sealed class DomainException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
