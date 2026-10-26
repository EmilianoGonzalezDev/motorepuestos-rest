using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace MotoRepuestos.Domain.Common;

/// <summary>
/// Builds accent/case-insensitive search text so catalog searches work the same on any collation
/// ("bateria" finds "Batería"). Descriptions are HTML, so tags are stripped first.
/// </summary>
public static partial class SearchText
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;

        var decomposed = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);

        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }

        return WhitespaceRegex().Replace(sb.ToString().Normalize(NormalizationForm.FormC), " ");
    }

    public static string StripHtml(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;
        var withoutTags = HtmlTagRegex().Replace(html, " ");
        return WebUtility.HtmlDecode(withoutTags).Trim();
    }

    public static string ForProduct(string name, string descriptionHtml) =>
        $"{Normalize(name)} {Normalize(StripHtml(descriptionHtml))}".Trim();

    public static string[] SplitTerms(string? search) =>
        Normalize(search).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
