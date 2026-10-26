namespace MotoRepuestos.Application.Common;

public static class ProductImages
{
    /// <summary>Path where the API serves product images (mapped to the image storage folder).</summary>
    public const string RequestPath = "/images/products";

    public const long MaxSizeBytes = 3 * 1024 * 1024;

    public static readonly IReadOnlySet<string> AllowedExtensions =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".gif" };

    public static string? Url(string? fileName) =>
        string.IsNullOrWhiteSpace(fileName) ? null : $"{RequestPath}/{fileName}";

    /// <summary>
    /// Checks the file signature ("magic numbers") so a renamed executable/script can't be uploaded as an image.
    /// </summary>
    public static bool HasValidSignature(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return true; // JPEG
        if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return true; // PNG
        if (header.Length >= 6 && (header[..6].SequenceEqual("GIF87a"u8) || header[..6].SequenceEqual("GIF89a"u8))) return true; // GIF
        if (header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8)) return true; // WEBP
        return false;
    }
}
