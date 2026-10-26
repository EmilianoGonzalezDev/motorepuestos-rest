using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Features.Carts;

namespace MotoRepuestos.Api.Controllers;

/// <summary>
/// Shopping cart for guests (identified by the X-Cart-Id header) and authenticated users.
/// </summary>
[ApiController]
[Route("api/cart")]
public sealed class CartController(CartService cartService) : ControllerBase
{
    [HttpGet]
    public async Task<CartDto> Get(CancellationToken ct) => await cartService.GetAsync(ct);

    [HttpPost("items")]
    [ProducesResponseType<CartDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CartDto>> AddItem(AddCartItemRequest request, CancellationToken ct) =>
        this.ToActionResult(await cartService.AddItemAsync(request, ct));

    [HttpPut("items/{productId:int}")]
    [ProducesResponseType<CartDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CartDto>> UpdateItem(int productId, UpdateCartItemRequest request, CancellationToken ct) =>
        this.ToActionResult(await cartService.UpdateItemAsync(productId, request, ct));

    [HttpDelete("items/{productId:int}")]
    public async Task<CartDto> RemoveItem(int productId, CancellationToken ct) =>
        await cartService.RemoveItemAsync(productId, ct);

    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        await cartService.ClearAsync(ct);
        return NoContent();
    }

    /// <summary>Merges the guest cart into the signed-in user's cart (called right after login).</summary>
    [HttpPost("merge")]
    [Authorize]
    public async Task<ActionResult<CartDto>> Merge(MergeCartRequest request, CancellationToken ct) =>
        this.ToActionResult(await cartService.MergeGuestCartAsync(request.GuestCartId, ct));
}
