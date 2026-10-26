using System.Text.Json.Serialization;
using FluentValidation;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Domain.Ordering;

namespace MotoRepuestos.Application.Features.Orders;

public sealed record PlaceOrderRequest(PaymentType PaymentType, string? Notes);

public sealed record CancelOrderRequest(string? Reason);

public sealed record ChangeOrderStatusRequest(OrderStatus Status, string? Note);

public sealed record MyOrdersQuery(int? Page, int? PageSize, OrderStatus? Status);

public sealed record AdminOrdersQuery(
    int? Page,
    int? PageSize,
    OrderStatus[]? Statuses,
    string? Search,
    DateOnly? From,
    DateOnly? To);

public sealed record OrderItemDto(
    int ProductId,
    string ProductName,
    [property: JsonIgnore] string? ImageFileName,
    decimal UnitPrice,
    int Quantity)
{
    public string? ImageUrl => ProductImages.Url(ImageFileName);
    public decimal Subtotal => UnitPrice * Quantity;
}

public sealed record OrderStatusChangeDto(OrderStatus Status, DateTime ChangedAt, string? Note, string? ChangedBy);

public sealed record OrderCustomerDto(int Id, string FullName, string Email);

public sealed record OrderSummaryDto(
    int Id,
    DateTime CreatedAt,
    OrderStatus Status,
    PaymentType PaymentType,
    decimal Total,
    int ItemCount,
    OrderCustomerDto Customer,
    IReadOnlyList<OrderItemDto> Items);

public sealed record OrderDetailDto(
    int Id,
    DateTime CreatedAt,
    OrderStatus Status,
    PaymentType PaymentType,
    string? Notes,
    decimal Total,
    OrderCustomerDto Customer,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<OrderStatusChangeDto> History,
    IReadOnlyList<OrderStatus> AllowedNextStatuses,
    bool CanCancel);

public sealed class PlaceOrderRequestValidator : AbstractValidator<PlaceOrderRequest>
{
    public PlaceOrderRequestValidator()
    {
        RuleFor(x => x.PaymentType).IsInEnum().WithMessage("Seleccioná un medio de pago válido.");
        RuleFor(x => x.Notes).MaximumLength(Order.NotesMaxLength)
            .WithMessage($"Las notas no pueden superar los {Order.NotesMaxLength} caracteres.");
    }
}

public sealed class ChangeOrderStatusRequestValidator : AbstractValidator<ChangeOrderStatusRequest>
{
    public ChangeOrderStatusRequestValidator()
    {
        RuleFor(x => x.Status).IsInEnum().WithMessage("Estado inválido.");
        RuleFor(x => x.Note).MaximumLength(OrderStatusChange.NoteMaxLength);
    }
}
