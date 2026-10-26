using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Categories;
using MotoRepuestos.Application.Features.Products;

namespace MotoRepuestos.Api.Controllers;

/// <summary>Back-office product management.</summary>
[ApiController]
[Route("api/products")]
[Authorize(Policy = Policies.Staff)]
public sealed class ProductsController(ProductService productService) : ControllerBase
{
    [HttpGet]
    public async Task<ProductListResponse> List([FromQuery] ProductListQuery query, CancellationToken ct) =>
        await productService.ListAsync(query, ct);

    [HttpGet("{id:int}")]
    [ProducesResponseType<ProductAdminDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductAdminDetailDto>> Get(int id, CancellationToken ct) =>
        this.ToActionResult(await productService.GetAsync(id, ct));

    [HttpPost]
    [ProducesResponseType<ProductAdminDetailDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductAdminDetailDto>> Create(UpsertProductRequest request, CancellationToken ct)
    {
        var result = await productService.CreateAsync(request, ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = result.Value.Id }, result.Value)
            : this.ToProblem(result.Error!);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType<ProductAdminDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductAdminDetailDto>> Update(int id, UpsertProductRequest request, CancellationToken ct) =>
        this.ToActionResult(await productService.UpdateAsync(id, request, ct));

    [HttpPatch("{id:int}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetStatus(int id, SetStatusRequest request, CancellationToken ct) =>
        this.ToNoContent(await productService.SetStatusAsync(id, request.IsActive, ct));

    /// <summary>Quick stock adjustment from the product list.</summary>
    [HttpPatch("{id:int}/stock")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetStock(int id, SetStockRequest request, CancellationToken ct) =>
        this.ToNoContent(await productService.SetStockAsync(id, request, ct));

    /// <summary>Uploads/replaces the product image (JPG, PNG, WEBP or GIF up to 3 MB).</summary>
    [HttpPut("{id:int}/image")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(4 * 1024 * 1024)]
    [ProducesResponseType<ProductImageDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductImageDto>> UploadImage(int id, IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        return this.ToActionResult(await productService.UploadImageAsync(id, stream, file.FileName, file.Length, ct));
    }

    [HttpDelete("{id:int}/image")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteImage(int id, CancellationToken ct) =>
        this.ToNoContent(await productService.DeleteImageAsync(id, ct));
}
