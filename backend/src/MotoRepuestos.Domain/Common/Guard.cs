namespace MotoRepuestos.Domain.Common;

internal static class Guard
{
    public static string NotEmpty(string? value, string field, int maxLength)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
            throw new DomainException($"{field}.required", $"El campo '{field}' es obligatorio.");
        if (trimmed.Length > maxLength)
            throw new DomainException($"{field}.too_long", $"El campo '{field}' no puede superar los {maxLength} caracteres.");
        return trimmed;
    }

    public static int Positive(int value, string field)
    {
        if (value <= 0)
            throw new DomainException($"{field}.not_positive", $"El campo '{field}' debe ser mayor a cero.");
        return value;
    }

    public static int NotNegative(int value, string field)
    {
        if (value < 0)
            throw new DomainException($"{field}.negative", $"El campo '{field}' no puede ser negativo.");
        return value;
    }

    public static decimal NotNegative(decimal value, string field)
    {
        if (value < 0)
            throw new DomainException($"{field}.negative", $"El campo '{field}' no puede ser negativo.");
        return value;
    }
}
