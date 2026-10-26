using FluentValidation;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Domain.Catalog;

namespace MotoRepuestos.Application.Features.Products;

public enum ProductSortBy
{
    Name,
    Price,
    Stock,
    Category,
    UpdatedAt
}

public enum ProductStatusFilter
{
    All,
    Active,
    Inactive
}

public sealed record ProductListQuery(
    int? Page,
    int? PageSize,
    string? Search,
    int? CategoryId,
    ProductStatusFilter? Status,
    bool? LowStockOnly,
    ProductSortBy? SortBy,
    SortDirection? SortDir);

public sealed record ProductAdminDto(
    int Id,
    string Name,
    decimal Price,
    int Stock,
    bool IsActive,
    bool IsLowStock,
    string? ImageUrl,
    int CategoryId,
    string CategoryName,
    bool CategoryIsActive,
    DateTime? UpdatedAt);

public sealed record ProductAdminDetailDto(
    int Id,
    string Name,
    string Description,
    decimal Price,
    int Stock,
    bool IsActive,
    string? ImageUrl,
    int CategoryId,
    string CategoryName,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record ProductListResponse(PagedResponse<ProductAdminDto> Products, int LowStockThreshold);

public sealed record UpsertProductRequest(int CategoryId, string Name, string Description, decimal Price, int Stock);

public sealed record SetStockRequest(int Stock);

public sealed record ProductImageDto(string? ImageUrl);

public sealed class UpsertProductRequestValidator : AbstractValidator<UpsertProductRequest>
{
    public UpsertProductRequestValidator()
    {
        RuleFor(x => x.CategoryId).GreaterThan(0).WithMessage("Seleccioná una categoría.");
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Indicá un nombre.")
            .MaximumLength(Product.NameMaxLength).WithMessage($"El nombre no puede superar los {Product.NameMaxLength} caracteres.");
        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Indicá una descripción para el producto.")
            .MaximumLength(Product.DescriptionMaxLength).WithMessage("La descripción es demasiado larga.");
        RuleFor(x => x.Price)
            .InclusiveBetween(0, Product.MaxPrice).WithMessage("Indicá un precio entre 0 y 9.999.999.999.");
        RuleFor(x => x.Stock)
            .InclusiveBetween(0, Product.MaxStock).WithMessage("El stock debe estar entre 0 y 9.999.999.");
    }
}

public sealed class SetStockRequestValidator : AbstractValidator<SetStockRequest>
{
    public SetStockRequestValidator()
    {
        RuleFor(x => x.Stock)
            .InclusiveBetween(0, Product.MaxStock).WithMessage("El stock debe estar entre 0 y 9.999.999.");
    }
}
