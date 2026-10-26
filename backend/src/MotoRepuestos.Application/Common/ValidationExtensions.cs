using FluentValidation;
using FluentValidation.Results;

namespace MotoRepuestos.Application.Common;

public static class ValidationExtensions
{
    /// <summary>Runs a FluentValidation validator and converts failures into a validation <see cref="Error"/>.</summary>
    public static async Task<Error?> ValidateToErrorAsync<T>(
        this IValidator<T> validator, T instance, CancellationToken cancellationToken = default)
    {
        var result = await validator.ValidateAsync(instance, cancellationToken);
        return result.IsValid ? null : result.ToError();
    }

    public static Error ToError(this ValidationResult result)
    {
        var errors = result.Errors
            .GroupBy(f => ToCamelCase(f.PropertyName))
            .ToDictionary(g => g.Key, g => g.Select(f => f.ErrorMessage).Distinct().ToArray());

        return Error.Validation("validation_failed", "Uno o más campos son inválidos.", errors);
    }

    private static string ToCamelCase(string name) =>
        string.IsNullOrEmpty(name) ? name : char.ToLowerInvariant(name[0]) + name[1..];
}
