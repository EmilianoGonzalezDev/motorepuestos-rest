using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Logging;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Catalog;
using MotoRepuestos.Application.Features.Settings;
using MotoRepuestos.Domain.Catalog;

namespace MotoRepuestos.Application.Features.Products;

/// <summary>Back-office product management (ABM, stock, images).</summary>
public sealed class ProductService(
    IAppDbContext db,
    SettingsService settings,
    IImageStorage imageStorage,
    IRichTextSanitizer htmlSanitizer,
    HybridCache cache,
    IValidator<UpsertProductRequest> upsertValidator,
    IValidator<SetStockRequest> stockValidator,
    ILogger<ProductService> logger)
{
    public async Task<ProductListResponse> ListAsync(ProductListQuery query, CancellationToken ct = default)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize);
        var threshold = await settings.GetLowStockThresholdAsync(ct);
        var products = db.Products.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            foreach (var term in Domain.Common.SearchText.SplitTerms(query.Search))
                products = products.Where(p => p.SearchText.Contains(term));
        }

        if (query.CategoryId is > 0) products = products.Where(p => p.CategoryId == query.CategoryId);

        products = query.Status switch
        {
            ProductStatusFilter.Active => products.Where(p => p.IsActive),
            ProductStatusFilter.Inactive => products.Where(p => !p.IsActive),
            _ => products
        };

        if (query.LowStockOnly == true) products = products.Where(p => p.Stock <= threshold);

        var desc = query.SortDir == SortDirection.Desc;
        products = (query.SortBy ?? ProductSortBy.Name) switch
        {
            ProductSortBy.Price => desc ? products.OrderByDescending(p => p.Price).ThenBy(p => p.Name) : products.OrderBy(p => p.Price).ThenBy(p => p.Name),
            ProductSortBy.Stock => desc ? products.OrderByDescending(p => p.Stock).ThenBy(p => p.Name) : products.OrderBy(p => p.Stock).ThenBy(p => p.Name),
            ProductSortBy.Category => desc ? products.OrderByDescending(p => p.Category!.Name).ThenBy(p => p.Name) : products.OrderBy(p => p.Category!.Name).ThenBy(p => p.Name),
            ProductSortBy.UpdatedAt => desc ? products.OrderByDescending(p => p.UpdatedAt ?? p.CreatedAt) : products.OrderBy(p => p.UpdatedAt ?? p.CreatedAt),
            _ => desc ? products.OrderByDescending(p => p.Name) : products.OrderBy(p => p.Name)
        };

        var paged = await products
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Price,
                p.Stock,
                p.IsActive,
                p.ImageFileName,
                p.CategoryId,
                CategoryName = p.Category!.Name,
                CategoryIsActive = p.Category.IsActive,
                p.UpdatedAt,
                p.CreatedAt
            })
            .ToPagedAsync(page, pageSize, ct);

        var items = paged.Items
            .Select(p => new ProductAdminDto(
                p.Id, p.Name, p.Price, p.Stock, p.IsActive, p.Stock <= threshold, ProductImages.Url(p.ImageFileName),
                p.CategoryId, p.CategoryName, p.CategoryIsActive, p.UpdatedAt ?? p.CreatedAt))
            .ToList();

        return new ProductListResponse(
            new PagedResponse<ProductAdminDto>(items, paged.Page, paged.PageSize, paged.TotalItems),
            threshold);
    }

    public async Task<Result<ProductAdminDetailDto>> GetAsync(int id, CancellationToken ct = default)
    {
        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.Price,
                p.Stock,
                p.IsActive,
                p.ImageFileName,
                p.CategoryId,
                CategoryName = p.Category!.Name,
                p.CreatedAt,
                p.UpdatedAt
            })
            .FirstOrDefaultAsync(ct);

        if (product is null) return NotFound();

        return new ProductAdminDetailDto(
            product.Id, product.Name, product.Description, product.Price, product.Stock, product.IsActive,
            ProductImages.Url(product.ImageFileName), product.CategoryId, product.CategoryName,
            product.CreatedAt, product.UpdatedAt);
    }

    public async Task<Result<ProductAdminDetailDto>> CreateAsync(UpsertProductRequest request, CancellationToken ct = default)
    {
        if (await upsertValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        if (!await db.Categories.AnyAsync(c => c.Id == request.CategoryId && c.IsActive, ct))
            return InvalidCategory();

        var product = Product.Create(
            request.CategoryId,
            request.Name,
            htmlSanitizer.Sanitize(request.Description),
            request.Price,
            request.Stock);

        db.Products.Add(product);
        await db.SaveChangesAsync(ct);
        await InvalidateCatalogAsync(ct);

        logger.LogInformation("Product {ProductId} created", product.Id);
        return await GetAsync(product.Id, ct);
    }

    public async Task<Result<ProductAdminDetailDto>> UpdateAsync(int id, UpsertProductRequest request, CancellationToken ct = default)
    {
        if (await upsertValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return NotFound();

        // Keeping the current (now inactive) category is allowed; moving to another inactive one is not.
        var categoryIsValid = request.CategoryId == product.CategoryId
            || await db.Categories.AnyAsync(c => c.Id == request.CategoryId && c.IsActive, ct);
        if (!categoryIsValid) return InvalidCategory();

        product.Update(
            request.CategoryId,
            request.Name,
            htmlSanitizer.Sanitize(request.Description),
            request.Price,
            request.Stock);

        await db.SaveChangesAsync(ct);
        await InvalidateCatalogAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<Result> SetStatusAsync(int id, bool isActive, CancellationToken ct = default)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return NotFound();

        if (isActive) product.Activate(); else product.Deactivate();

        await db.SaveChangesAsync(ct);
        await InvalidateCatalogAsync(ct);
        return Result.Success();
    }

    public async Task<Result> SetStockAsync(int id, SetStockRequest request, CancellationToken ct = default)
    {
        if (await stockValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return NotFound();

        product.SetStock(request.Stock);
        await db.SaveChangesAsync(ct);
        await InvalidateCatalogAsync(ct);
        return Result.Success();
    }

    public async Task<Result<ProductImageDto>> UploadImageAsync(
        int id, Stream content, string fileName, long length, CancellationToken ct = default)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return NotFound();

        var extension = Path.GetExtension(fileName);
        if (!ProductImages.AllowedExtensions.Contains(extension))
            return InvalidImage("Formato no soportado. Usá JPG, PNG, WEBP o GIF.");

        if (length is <= 0 or > ProductImages.MaxSizeBytes)
            return InvalidImage("La imagen debe pesar como máximo 3 MB.");

        // Read into memory (bounded by MaxSizeBytes) so the signature can be checked before touching disk.
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        if (!ProductImages.HasValidSignature(buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 16))))
            return InvalidImage("El archivo no es una imagen válida.");

        if (!imageStorage.HasRoomFor(buffer.Length))
            return Error.Conflict("product.image_storage_full",
                "Se alcanzó el espacio máximo para imágenes. Eliminá imágenes que no uses o intentá más tarde.");

        buffer.Position = 0;
        var newFileName = await imageStorage.SaveAsync(buffer, extension.ToLowerInvariant(), ct);
        var previous = product.ImageFileName;

        product.SetImage(newFileName);
        await db.SaveChangesAsync(ct);

        if (previous is not null) imageStorage.Delete(previous);
        await InvalidateCatalogAsync(ct);

        return new ProductImageDto(ProductImages.Url(newFileName));
    }

    public async Task<Result> DeleteImageAsync(int id, CancellationToken ct = default)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return NotFound();
        if (product.ImageFileName is null) return Result.Success();

        var previous = product.ImageFileName;
        product.SetImage(null);
        await db.SaveChangesAsync(ct);
        imageStorage.Delete(previous);
        await InvalidateCatalogAsync(ct);
        return Result.Success();
    }

    private async Task InvalidateCatalogAsync(CancellationToken ct) =>
        await cache.RemoveByTagAsync(CatalogService.CacheTag, ct);

    private static Error NotFound() => Error.NotFound("product.not_found", "Producto no encontrado.");

    private static Error InvalidCategory() =>
        Error.Validation("product.invalid_category", "La categoría seleccionada no existe o está inactiva.",
            new Dictionary<string, string[]> { ["categoryId"] = ["La categoría seleccionada no existe o está inactiva."] });

    private static Error InvalidImage(string message) =>
        Error.Validation("product.invalid_image", message,
            new Dictionary<string, string[]> { ["file"] = [message] });
}
