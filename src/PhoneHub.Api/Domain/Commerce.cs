namespace PhoneHub.Api.Domain;

public class Cart
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<CartItem> Items { get; set; } = [];
}

public class CartItem
{
    public int Id { get; set; }
    public int CartId { get; set; }
    public Cart Cart { get; set; } = null!;
    public int VariantId { get; set; }
    public ProductVariant Variant { get; set; } = null!;
    public int Quantity { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}

public class WishlistItem
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum CouponType { Percent = 1, Fixed = 2 }

public class Coupon
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Description { get; set; } = "";
    public CouponType Type { get; set; }
    /// <summary>Percent: 1–100; Fixed: số tiền VND.</summary>
    public decimal Value { get; set; }
    public decimal? MaxDiscount { get; set; }
    public decimal MinOrderAmount { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public int? UsageLimit { get; set; }
    public int UsedCount { get; set; }
    public int? PerUserLimit { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsPublic { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class OrderStatus
{
    public const string AwaitingPayment = "AwaitingPayment";
    public const string Pending = "Pending";
    public const string Confirmed = "Confirmed";
    public const string Shipping = "Shipping";
    public const string Delivered = "Delivered";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All = [AwaitingPayment, Pending, Confirmed, Shipping, Delivered, Cancelled];

    private static readonly Dictionary<string, string[]> Transitions = new()
    {
        [AwaitingPayment] = [Pending, Cancelled],
        [Pending] = [Confirmed, Cancelled],
        [Confirmed] = [Shipping, Cancelled],
        [Shipping] = [Delivered],
        [Delivered] = [],
        [Cancelled] = [],
    };

    public static bool CanTransition(string from, string to) =>
        Transitions.TryGetValue(from, out var next) && next.Contains(to);
}

public static class PaymentStatus
{
    public const string Unpaid = "Unpaid";
    public const string Pending = "Pending";
    public const string Paid = "Paid";
    public const string Failed = "Failed";
    public const string Refunded = "Refunded";
}

public class Order
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Status { get; set; } = OrderStatus.Pending;
    public string PaymentMethod { get; set; } = "cod";
    public string PaymentStatus { get; set; } = Domain.PaymentStatus.Unpaid;
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal ShippingFee { get; set; }
    public decimal Total { get; set; }
    public int? CouponId { get; set; }
    public Coupon? Coupon { get; set; }
    public string? CouponCode { get; set; }
    // Snapshot địa chỉ giao hàng — địa chỉ trong sổ có thể bị sửa/xóa sau này.
    public string ShipName { get; set; } = "";
    public string ShipPhone { get; set; } = "";
    public string ShipAddress { get; set; } = "";
    public string? Note { get; set; }
    public string? CancelReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<OrderItem> Items { get; set; } = [];
    public List<Payment> Payments { get; set; } = [];
}

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public int? VariantId { get; set; }
    public ProductVariant? Variant { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public string ProductSlug { get; set; } = "";
    public string VariantName { get; set; } = "";
    public string Sku { get; set; } = "";
    public string? ImageUrl { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
}

public class Payment
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public string Provider { get; set; } = "";
    public decimal Amount { get; set; }
    public string Status { get; set; } = PaymentStatus.Pending;
    /// <summary>Mã giao dịch phía PhoneHub gửi sang cổng (unique).</summary>
    public string TxnRef { get; set; } = "";
    public string? ProviderTxnId { get; set; }
    public string? ResponseCode { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}

public class Review
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int Rating { get; set; }
    public string? Title { get; set; }
    public string Content { get; set; } = "";
    public bool IsApproved { get; set; } = true;
    public bool IsVerifiedPurchase { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ContactMessage
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
    public string Subject { get; set; } = "";
    public string Message { get; set; } = "";
    public bool IsHandled { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AuditLog
{
    public long Id { get; set; }
    public int? UserId { get; set; }
    public string Action { get; set; } = "";
    public string Entity { get; set; } = "";
    public string? EntityId { get; set; }
    public string? Data { get; set; }
    public string? Ip { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
