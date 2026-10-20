using System.ComponentModel.DataAnnotations;

namespace PhoneHub.Api.Contracts;

public record AddCartItemRequest([Range(1, int.MaxValue)] int VariantId, [Range(1, 99, ErrorMessage = "Số lượng không hợp lệ")] int Quantity);
public record UpdateCartItemRequest([Range(1, 99, ErrorMessage = "Số lượng không hợp lệ")] int Quantity);

public record CartItemDto(
    int VariantId, int ProductId, string ProductName, string ProductSlug, string VariantName, string Sku, string? ImageUrl,
    decimal UnitPrice, decimal? CompareAtPrice, int Quantity, decimal LineTotal, int Stock, string? Issue);

public record CartDto(IReadOnlyList<CartItemDto> Items, int ItemCount, decimal Subtotal, decimal ShippingFee, decimal Total, bool HasIssues);

public record CheckoutPreviewRequest([MaxLength(40)] string? CouponCode);

public record CheckoutPreviewResponse(
    IReadOnlyList<CartItemDto> Items, decimal Subtotal, decimal DiscountAmount, decimal ShippingFee, decimal Total,
    string? CouponCode, string? CouponMessage, bool CouponApplied);

public record ShippingAddressInput(
    [Required(ErrorMessage = "Vui lòng nhập tên người nhận"), StringLength(120, MinimumLength = 2)] string RecipientName,
    [Required(ErrorMessage = "Vui lòng nhập số điện thoại"), VnPhone] string Phone,
    [Required(ErrorMessage = "Vui lòng nhập địa chỉ"), StringLength(255, MinimumLength = 5)] string Line1,
    [MaxLength(100)] string? Ward,
    [Required, MaxLength(100)] string District,
    [Required, MaxLength(100)] string Province,
    bool SaveToAddressBook = false);

public record PlaceOrderRequest(
    int? AddressId,
    ShippingAddressInput? Address,
    [Required, RegularExpression("^[a-z]{2,20}$")] string PaymentMethod,
    [MaxLength(40)] string? CouponCode,
    [MaxLength(500)] string? Note);

public record OrderItemDto(int? VariantId, int ProductId, string ProductName, string ProductSlug, string VariantName, string Sku, string? ImageUrl, decimal UnitPrice, int Quantity, decimal LineTotal);
public record PaymentDto(string Provider, decimal Amount, string Status, string TxnRef, DateTime CreatedAt, DateTime? PaidAt);

public record OrderSummaryDto(string Code, string Status, string PaymentMethod, string PaymentStatus, decimal Total, int ItemCount, string? FirstItemName, string? FirstItemImage, DateTime CreatedAt);

public record OrderDetailDto(
    string Code, string Status, string PaymentMethod, string PaymentStatus,
    decimal Subtotal, decimal DiscountAmount, decimal ShippingFee, decimal Total, string? CouponCode,
    string ShipName, string ShipPhone, string ShipAddress, string? Note, string? CancelReason,
    DateTime CreatedAt, DateTime UpdatedAt, IReadOnlyList<OrderItemDto> Items, IReadOnlyList<PaymentDto> Payments,
    bool CanCancel, bool CanPay, string? CustomerEmail = null, string? CustomerName = null);

public record PlaceOrderResponse(OrderDetailDto Order, string? PaymentUrl);

public record CancelOrderRequest([MaxLength(255)] string? Reason);

public record PaymentMethodDto(string Code, string Name, string Description, bool IsOnline);
