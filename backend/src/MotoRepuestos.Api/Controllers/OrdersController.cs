using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Orders;

namespace MotoRepuestos.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public sealed class OrdersController(OrderService orderService, TimeProvider clock) : ControllerBase
{
    /// <summary>Checkout: creates an order from the current user's cart.</summary>
    [HttpPost]
    [ProducesResponseType<OrderDetailDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDetailDto>> Place(PlaceOrderRequest request, CancellationToken ct)
    {
        var result = await orderService.PlaceOrderAsync(request, ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = result.Value.Id }, result.Value)
            : this.ToProblem(result.Error!);
    }

    [HttpGet("mine")]
    public async Task<PagedResponse<OrderSummaryDto>> Mine([FromQuery] MyOrdersQuery query, CancellationToken ct) =>
        await orderService.GetMyOrdersAsync(query, ct);

    [HttpGet("{id:int}")]
    [ProducesResponseType<OrderDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderDetailDto>> Get(int id, CancellationToken ct) =>
        this.ToActionResult(await orderService.GetAsync(id, ct));

    /// <summary>Customers can cancel their own pending orders; stock is returned.</summary>
    [HttpPost("{id:int}/cancel")]
    [ProducesResponseType<OrderDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDetailDto>> Cancel(int id, CancelOrderRequest request, CancellationToken ct) =>
        this.ToActionResult(await orderService.CancelMyOrderAsync(id, request, ct));

    [HttpGet]
    [Authorize(Policy = Policies.Staff)]
    public async Task<PagedResponse<OrderSummaryDto>> List([FromQuery] AdminOrdersQuery query, CancellationToken ct) =>
        await orderService.ListAsync(query, ct);

    [HttpPatch("{id:int}/status")]
    [Authorize(Policy = Policies.Staff)]
    [ProducesResponseType<OrderDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDetailDto>> ChangeStatus(int id, ChangeOrderStatusRequest request, CancellationToken ct) =>
        this.ToActionResult(await orderService.ChangeStatusAsync(id, request, ct));

    [HttpGet("export")]
    [Authorize(Policy = Policies.Staff)]
    [Produces("text/csv")]
    public async Task<FileResult> Export([FromQuery] AdminOrdersQuery query, CancellationToken ct)
    {
        var csv = await orderService.ExportCsvAsync(query, ct);
        var fileName = $"pedidos_{StoreTime.Today(clock):yyyyMMdd}.csv";
        return File(csv, "text/csv; charset=utf-8", fileName);
    }
}
