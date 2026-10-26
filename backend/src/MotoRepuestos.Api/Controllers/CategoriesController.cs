using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Categories;

namespace MotoRepuestos.Api.Controllers;

public sealed record AvailabilityResponse(bool Available);

[ApiController]
[Route("api/categories")]
[Authorize(Policy = Policies.Staff)]
public sealed class CategoriesController(CategoryService categoryService) : ControllerBase
{
    [HttpGet]
    public async Task<PagedResponse<CategoryAdminDto>> List([FromQuery] CategoryListQuery query, CancellationToken ct) =>
        await categoryService.ListAsync(query, ct);

    /// <summary>Categories selectable in the product form.</summary>
    [HttpGet("options")]
    public async Task<IReadOnlyList<CategoryOptionDto>> Options([FromQuery] int? includeId, CancellationToken ct) =>
        await categoryService.GetOptionsAsync(includeId, ct);

    /// <summary>Used by the Angular async validator while typing a category name.</summary>
    [HttpGet("name-availability")]
    public async Task<AvailabilityResponse> NameAvailability([FromQuery] string? name, [FromQuery] int? excludeId, CancellationToken ct) =>
        new(await categoryService.IsNameAvailableAsync(name, excludeId, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CategoryAdminDto>> Get(int id, CancellationToken ct) =>
        this.ToActionResult(await categoryService.GetAsync(id, ct));

    [HttpPost]
    [ProducesResponseType<CategoryAdminDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CategoryAdminDto>> Create(UpsertCategoryRequest request, CancellationToken ct)
    {
        var result = await categoryService.CreateAsync(request, ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = result.Value.Id }, result.Value)
            : this.ToProblem(result.Error!);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CategoryAdminDto>> Update(int id, UpsertCategoryRequest request, CancellationToken ct) =>
        this.ToActionResult(await categoryService.UpdateAsync(id, request, ct));

    /// <summary>Activates/deactivates a category (409 if it still has active products).</summary>
    [HttpPatch("{id:int}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SetStatus(int id, SetStatusRequest request, CancellationToken ct) =>
        this.ToNoContent(await categoryService.SetStatusAsync(id, request.IsActive, ct));
}
