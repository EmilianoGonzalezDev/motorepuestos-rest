namespace MotoRepuestos.Application.Features.Catalog;

public enum CatalogSort
{
    Newest,
    PriceAsc,
    PriceDesc,
    NameAsc
}

public sealed record CatalogQuery(
    int? Page,
    int? PageSize,
    int? CategoryId,
    string? Search,
    decimal? MinPrice,
    decimal? MaxPrice,
    CatalogSort? Sort);

public sealed record CatalogCategoryDto(int Id, string Name, int ProductCount);

public sealed record CategoryRefDto(int Id, string Name);

public sealed record ProductCardDto(
    int Id,
    string Name,
    decimal Price,
    string? ImageUrl,
    int Stock,
    bool IsLowStock,
    bool IsAvailable,
    CategoryRefDto Category);

public sealed record ProductDetailDto(
    int Id,
    string Name,
    string Description,
    decimal Price,
    string? ImageUrl,
    int Stock,
    bool IsLowStock,
    bool IsAvailable,
    CategoryRefDto Category);

public sealed record SearchSuggestionDto(int Id, string Name, decimal Price, string? ImageUrl, string CategoryName);

public sealed record PriceRangeDto(decimal Min, decimal Max);
