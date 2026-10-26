using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Catalog;

namespace MotoRepuestos.Api.Controllers;

/// <summary>Public storefront: only sellable products (active, with stock, in an active category).</summary>
[ApiController]
[Route("api/catalog")]
[AllowAnonymous]
public sealed class CatalogController(CatalogService catalogService) : ControllerBase
{
    [HttpGet("categories")]
    public async Task<IReadOnlyList<CatalogCategoryDto>> GetCategories(CancellationToken ct) =>
        await catalogService.GetCategoriesAsync(ct);

    /// <summary>Paged catalog with category, text (accent-insensitive) and price filters.</summary>
    [HttpGet("products")]
    public async Task<PagedResponse<ProductCardDto>> GetProducts([FromQuery] CatalogQuery query, CancellationToken ct) =>
        await catalogService.SearchAsync(query, ct);

    [HttpGet("products/{id:int}")]
    [ProducesResponseType<ProductDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDetailDto>> GetProduct(int id, CancellationToken ct) =>
        this.ToActionResult(await catalogService.GetProductAsync(id, ct));

    [HttpGet("products/{id:int}/related")]
    public async Task<IReadOnlyList<ProductCardDto>> GetRelated(int id, [FromQuery] int take = 4, CancellationToken ct = default) =>
        await catalogService.GetRelatedAsync(id, take, ct);

    /// <summary>Autocomplete for the search box.</summary>
    [HttpGet("suggestions")]
    public async Task<IReadOnlyList<SearchSuggestionDto>> GetSuggestions([FromQuery] string? q, [FromQuery] int take = 8, CancellationToken ct = default) =>
        await catalogService.GetSuggestionsAsync(q, take, ct);

    [HttpGet("price-range")]
    public async Task<PriceRangeDto> GetPriceRange([FromQuery] int? categoryId, CancellationToken ct) =>
        await catalogService.GetPriceRangeAsync(categoryId, ct);
}
