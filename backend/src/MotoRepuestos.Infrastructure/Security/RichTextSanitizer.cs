using Ganss.Xss;
using MotoRepuestos.Application.Abstractions;

namespace MotoRepuestos.Infrastructure.Security;

/// <summary>
/// Product descriptions are rich text written in the back office and rendered as HTML in the
/// storefront, so they are whitelisted server-side to prevent stored XSS.
/// </summary>
internal sealed class RichTextSanitizer : IRichTextSanitizer
{
    private readonly HtmlSanitizer _sanitizer;

    public RichTextSanitizer()
    {
        _sanitizer = new HtmlSanitizer();
        _sanitizer.AllowedTags.Clear();
        foreach (var tag in new[] { "p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h3", "h4", "blockquote", "a" })
            _sanitizer.AllowedTags.Add(tag);

        _sanitizer.AllowedAttributes.Clear();
        _sanitizer.AllowedAttributes.Add("href");
        _sanitizer.AllowedCssProperties.Clear();
        _sanitizer.AllowedSchemes.Clear();
        _sanitizer.AllowedSchemes.Add("https");
        _sanitizer.AllowedSchemes.Add("http");
        _sanitizer.AllowedSchemes.Add("mailto");

        _sanitizer.PostProcessNode += (_, e) =>
        {
            if (e.Node is AngleSharp.Html.Dom.IHtmlAnchorElement anchor)
            {
                anchor.SetAttribute("target", "_blank");
                anchor.SetAttribute("rel", "noopener noreferrer");
            }
        };
        _sanitizer.AllowedAttributes.Add("target");
        _sanitizer.AllowedAttributes.Add("rel");
    }

    public string Sanitize(string html) => _sanitizer.Sanitize(html ?? string.Empty).Trim();
}
