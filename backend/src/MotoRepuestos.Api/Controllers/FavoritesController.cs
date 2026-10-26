using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Features.Catalog;
using MotoRepuestos.Application.Features.Favorites;

namespace MotoRepuestos.Api.Controllers;

[ApiController]
[Route("api/favorites")]
[Authorize]
public sealed class FavoritesController(FavoriteService favoriteService) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<ProductCardDto>> List(CancellationToken ct) => await favoriteService.ListAsync(ct);

    /// <summary>Product ids only, so the storefront can paint the hearts without loading products.</summary>
    [HttpGet("ids")]
    public async Task<IReadOnlyList<int>> Ids(CancellationToken ct) => await favoriteService.GetIdsAsync(ct);

    /// <summary>Idempotent: saving an existing favorite is a no-op.</summary>
    [HttpPut("{productId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Add(int productId, CancellationToken ct) =>
        this.ToNoContent(await favoriteService.AddAsync(productId, ct));

    [HttpDelete("{productId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Remove(int productId, CancellationToken ct)
    {
        await favoriteService.RemoveAsync(productId, ct);
        return NoContent();
    }
}
