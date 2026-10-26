using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Settings;
using MotoRepuestos.Domain.Catalog;
using MotoRepuestos.Domain.Common;

namespace MotoRepuestos.Application.Features.Catalog;

/// <summary>Public, read-only storefront queries. Only sellable products are exposed.</summary>
public sealed class CatalogService(IAppDbContext db, SettingsService settings, HybridCache cache)
{
    public const string CacheTag = "catalog";
    public const int DefaultPageSize = 12;
    private static readonly HybridCacheEntryOptions CategoriesCacheOptions = new() { Expiration = TimeSpan.FromMinutes(10) };

    public async Task<IReadOnlyList<CatalogCategoryDto>> GetCategoriesAsync(CancellationToken ct = default) =>
        await cache.GetOrCreateAsync(
            "catalog:categories",
            async token => (IReadOnlyList<CatalogCategoryDto>)await db.Categories.AsNoTracking()
                .Where(c => c.IsActive && c.Products.Any(p => p.IsActive && p.Stock > 0))
                .OrderBy(c => c.Name)
                .Select(c => new CatalogCategoryDto(c.Id, c.Name, c.Products.Count(p => p.IsActive && p.Stock > 0)))
                .ToListAsync(token),
            CategoriesCacheOptions,
            tags: [CacheTag],
            cancellationToken: ct);

    public async Task<PagedResponse<ProductCardDto>> SearchAsync(CatalogQuery query, CancellationToken ct = default)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize, DefaultPageSize);
        var threshold = await settings.GetLowStockThresholdAsync(ct);

        var products = db.Products.AsNoTracking().Sellable();

        if (query.CategoryId is > 0)
            products = products.Where(p => p.CategoryId == query.CategoryId);

        foreach (var term in SearchText.SplitTerms(query.Search))
            products = products.Where(p => p.SearchText.Contains(term));

        if (query.MinPrice is { } min) products = products.Where(p => p.Price >= min);
        if (query.MaxPrice is { } max) products = products.Where(p => p.Price <= max);

        products = (query.Sort ?? CatalogSort.Newest) switch
        {
            CatalogSort.PriceAsc => products.OrderBy(p => p.Price).ThenBy(p => p.Name),
            CatalogSort.PriceDesc => products.OrderByDescending(p => p.Price).ThenBy(p => p.Name),
            CatalogSort.NameAsc => products.OrderBy(p => p.Name),
            _ => products.OrderByDescending(p => p.Id)
        };

        var paged = await products
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Price,
                p.ImageFileName,
                p.Stock,
                CategoryId = p.Category!.Id,
                CategoryName = p.Category.Name
            })
            .ToPagedAsync(page, pageSize, ct);

        var items = paged.Items
            .Select(p => new ProductCardDto(
                p.Id, p.Name, p.Price, ProductImages.Url(p.ImageFileName), p.Stock,
                IsLowStock: p.Stock <= threshold, IsAvailable: true,
                new CategoryRefDto(p.CategoryId, p.CategoryName)))
            .ToList();

        return new PagedResponse<ProductCardDto>(items, paged.Page, paged.PageSize, paged.TotalItems);
    }

    public async Task<Result<ProductDetailDto>> GetProductAsync(int id, CancellationToken ct = default)
    {
        var threshold = await settings.GetLowStockThresholdAsync(ct);

        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == id && p.IsActive && p.Category!.IsActive)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.Price,
                p.ImageFileName,
                p.Stock,
                CategoryId = p.Category!.Id,
                CategoryName = p.Category.Name
            })
            .FirstOrDefaultAsync(ct);

        if (product is null)
            return Error.NotFound("product.not_found", "El producto no existe o no está disponible.");

        return new ProductDetailDto(
            product.Id,
            product.Name,
            product.Description,
            product.Price,
            ProductImages.Url(product.ImageFileName),
            product.Stock,
            IsLowStock: product.Stock > 0 && product.Stock <= threshold,
            IsAvailable: product.Stock > 0,
            new CategoryRefDto(product.CategoryId, product.CategoryName));
    }

    public async Task<IReadOnlyList<ProductCardDto>> GetRelatedAsync(int id, int take, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 12);
        var threshold = await settings.GetLowStockThresholdAsync(ct);

        var categoryId = await db.Products.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => (int?)p.CategoryId)
            .FirstOrDefaultAsync(ct);

        if (categoryId is null) return [];

        var related = await db.Products.AsNoTracking()
            .Sellable()
            .Where(p => p.CategoryId == categoryId && p.Id != id)
            .OrderByDescending(p => p.Id)
            .Take(take)
            .Select(p => new { p.Id, p.Name, p.Price, p.ImageFileName, p.Stock, CategoryName = p.Category!.Name })
            .ToListAsync(ct);

        return related
            .Select(p => new ProductCardDto(
                p.Id, p.Name, p.Price, ProductImages.Url(p.ImageFileName), p.Stock,
                p.Stock <= threshold, true, new CategoryRefDto(categoryId.Value, p.CategoryName)))
            .ToList();
    }

    /// <summary>
    /// Search-box suggestions ranked by exact match, then prefix match, then shorter names.
    /// Only a bounded candidate set is read from the database.
    /// </summary>
    public async Task<IReadOnlyList<SearchSuggestionDto>> GetSuggestionsAsync(string? search, int take, CancellationToken ct = default)
    {
        var terms = SearchText.SplitTerms(search);
        if (terms.Length == 0) return [];

        take = Math.Clamp(take, 1, 15);
        var products = db.Products.AsNoTracking().Sellable();
        foreach (var term in terms)
            products = products.Where(p => p.SearchText.Contains(term));

        var candidates = await products
            .OrderBy(p => p.Name)
            .Take(50)
            .Select(p => new { p.Id, p.Name, p.Price, p.ImageFileName, CategoryName = p.Category!.Name })
            .ToListAsync(ct);

        var normalizedSearch = SearchText.Normalize(search);

        return candidates
            .Select(p => new { Product = p, Name = SearchText.Normalize(p.Name) })
            .OrderByDescending(x => x.Name == normalizedSearch)
            .ThenByDescending(x => x.Name.StartsWith(normalizedSearch, StringComparison.Ordinal))
            .ThenByDescending(x => x.Name.Contains(normalizedSearch, StringComparison.Ordinal))
            .ThenBy(x => x.Name.Length)
            .ThenBy(x => x.Name, StringComparer.Ordinal)
            .Take(take)
            .Select(x => new SearchSuggestionDto(
                x.Product.Id, x.Product.Name, x.Product.Price, ProductImages.Url(x.Product.ImageFileName), x.Product.CategoryName))
            .ToList();
    }

    public async Task<PriceRangeDto> GetPriceRangeAsync(int? categoryId, CancellationToken ct = default)
    {
        var products = db.Products.AsNoTracking().Sellable();
        if (categoryId is > 0) products = products.Where(p => p.CategoryId == categoryId);

        var prices = await products
            .GroupBy(_ => 1)
            .Select(g => new { Min = g.Min(p => p.Price), Max = g.Max(p => p.Price) })
            .FirstOrDefaultAsync(ct);

        return prices is null ? new PriceRangeDto(0, 0) : new PriceRangeDto(prices.Min, prices.Max);
    }
}

public static class ProductQueryExtensions
{
    /// <summary>Products a customer can buy: active, with stock and inside an active category.</summary>
    public static IQueryable<Product> Sellable(this IQueryable<Product> products) =>
        products.Where(p => p.IsActive && p.Stock > 0 && p.Category!.IsActive);
}
