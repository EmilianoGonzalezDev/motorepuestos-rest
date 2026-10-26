using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Catalog;
using MotoRepuestos.Domain.Catalog;

namespace MotoRepuestos.Application.Features.Categories;

public sealed record CategoryListQuery(int? Page, int? PageSize, string? Search, bool? IsActive);

public sealed record CategoryAdminDto(int Id, string Name, bool IsActive, int ProductCount, int ActiveProductCount);

public sealed record CategoryOptionDto(int Id, string Name, bool IsActive);

public sealed record UpsertCategoryRequest(string Name);

public sealed record SetStatusRequest(bool IsActive);

public sealed class UpsertCategoryRequestValidator : AbstractValidator<UpsertCategoryRequest>
{
    public UpsertCategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Indicá un nombre.")
            .MaximumLength(Category.NameMaxLength).WithMessage($"El nombre no puede superar los {Category.NameMaxLength} caracteres.");
    }
}

public sealed class CategoryService(
    IAppDbContext db,
    HybridCache cache,
    IValidator<UpsertCategoryRequest> validator)
{
    public async Task<PagedResponse<CategoryAdminDto>> ListAsync(CategoryListQuery query, CancellationToken ct = default)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize);
        var categories = db.Categories.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            categories = categories.Where(c => c.Name.ToLower().Contains(term));
        }

        if (query.IsActive is { } isActive) categories = categories.Where(c => c.IsActive == isActive);

        return await categories
            .OrderBy(c => c.Name)
            .Select(c => new CategoryAdminDto(
                c.Id, c.Name, c.IsActive, c.Products.Count, c.Products.Count(p => p.IsActive)))
            .ToPagedAsync(page, pageSize, ct);
    }

    /// <summary>Options for the product form: active categories plus, when editing, the product's current one.</summary>
    public async Task<IReadOnlyList<CategoryOptionDto>> GetOptionsAsync(int? includeCategoryId, CancellationToken ct = default) =>
        await db.Categories.AsNoTracking()
            .Where(c => c.IsActive || c.Id == includeCategoryId)
            .OrderBy(c => c.Name)
            .Select(c => new CategoryOptionDto(c.Id, c.Name, c.IsActive))
            .ToListAsync(ct);

    public async Task<Result<CategoryAdminDto>> GetAsync(int id, CancellationToken ct = default)
    {
        var category = await db.Categories.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CategoryAdminDto(c.Id, c.Name, c.IsActive, c.Products.Count, c.Products.Count(p => p.IsActive)))
            .FirstOrDefaultAsync(ct);

        return category is null ? NotFound() : category;
    }

    public async Task<bool> IsNameAvailableAsync(string? name, int? excludeId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name)) return false;
        var normalized = name.Trim().ToUpper();
        return !await db.Categories.AnyAsync(c => c.Name.ToUpper() == normalized && c.Id != excludeId, ct);
    }

    public async Task<Result<CategoryAdminDto>> CreateAsync(UpsertCategoryRequest request, CancellationToken ct = default)
    {
        if (await validator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        if (!await IsNameAvailableAsync(request.Name, null, ct))
            return DuplicateName();

        var category = Category.Create(request.Name);
        db.Categories.Add(category);
        await db.SaveChangesAsync(ct);
        await cache.RemoveByTagAsync(CatalogService.CacheTag, ct);

        return new CategoryAdminDto(category.Id, category.Name, category.IsActive, 0, 0);
    }

    public async Task<Result<CategoryAdminDto>> UpdateAsync(int id, UpsertCategoryRequest request, CancellationToken ct = default)
    {
        if (await validator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (category is null) return NotFound();

        if (!await IsNameAvailableAsync(request.Name, id, ct))
            return DuplicateName();

        category.Rename(request.Name);
        await db.SaveChangesAsync(ct);
        await cache.RemoveByTagAsync(CatalogService.CacheTag, ct);

        return await GetAsync(id, ct);
    }

    public async Task<Result> SetStatusAsync(int id, bool isActive, CancellationToken ct = default)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (category is null) return NotFound();

        if (isActive)
        {
            category.Activate();
        }
        else
        {
            var hasActiveProducts = await db.Products.AnyAsync(p => p.CategoryId == id && p.IsActive, ct);
            category.Deactivate(hasActiveProducts);
        }

        await db.SaveChangesAsync(ct);
        await cache.RemoveByTagAsync(CatalogService.CacheTag, ct);
        return Result.Success();
    }

    private static Error NotFound() => Error.NotFound("category.not_found", "Categoría no encontrada.");

    private static Error DuplicateName() =>
        Error.Validation("category.duplicate_name", "Ya existe una categoría con ese nombre.",
            new Dictionary<string, string[]> { ["name"] = ["Ya existe una categoría con ese nombre."] });
}
