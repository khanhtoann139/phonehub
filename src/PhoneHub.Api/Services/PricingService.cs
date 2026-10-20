using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PhoneHub.Api.Data;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;

namespace PhoneHub.Api.Services;

public record PriceLine(int VariantId, decimal UnitPrice, int Quantity)
{
    public decimal LineTotal => UnitPrice * Quantity;
}

public record PriceBreakdown(decimal Subtotal, decimal DiscountAmount, decimal ShippingFee, decimal Total);

/// <summary>
/// Nguồn sự thật duy nhất về tiền. Giá đơn vị luôn lấy từ DB (ProductVariant.Price) — không bao giờ nhận giá từ client.
/// </summary>
public class PricingService(IOptions<ShopOptions> shop)
{
    public PriceBreakdown Calculate(IReadOnlyCollection<PriceLine> lines, Coupon? coupon)
    {
        var subtotal = lines.Sum(l => l.LineTotal);
        var discount = coupon is null ? 0 : CouponDiscount(coupon, subtotal);
        var afterDiscount = subtotal - discount;
        var shipping = lines.Count == 0 || afterDiscount >= shop.Value.FreeShippingThreshold ? 0 : shop.Value.ShippingFee;
        return new PriceBreakdown(subtotal, discount, shipping, afterDiscount + shipping);
    }

    public static decimal CouponDiscount(Coupon coupon, decimal subtotal)
    {
        if (subtotal <= 0) return 0;
        var discount = coupon.Type switch
        {
            CouponType.Percent => Math.Floor(subtotal * Math.Clamp(coupon.Value, 0, 100) / 100m),
            CouponType.Fixed => coupon.Value,
            _ => 0,
        };
        if (coupon.MaxDiscount is { } max && max > 0) discount = Math.Min(discount, max);
        return Math.Min(Math.Max(discount, 0), subtotal);
    }
}

public class CouponService(AppDbContext db, TimeProvider clock)
{
    /// <summary>Trả về coupon hợp lệ, hoặc ném AppException với lý do cụ thể.</summary>
    public async Task<Coupon> ValidateAsync(string code, int userId, decimal subtotal)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Code == normalized);
        var now = clock.GetUtcNow().UtcDateTime;

        if (coupon is null || !coupon.IsActive) throw AppException.BadRequest("Mã giảm giá không tồn tại", "coupon_invalid");
        if (now < coupon.StartsAt) throw AppException.BadRequest("Mã giảm giá chưa đến thời gian áp dụng", "coupon_not_started");
        if (now > coupon.EndsAt) throw AppException.BadRequest("Mã giảm giá đã hết hạn", "coupon_expired");
        if (coupon.UsageLimit is { } limit && coupon.UsedCount >= limit)
            throw AppException.BadRequest("Mã giảm giá đã hết lượt sử dụng", "coupon_exhausted");
        if (subtotal < coupon.MinOrderAmount)
            throw AppException.BadRequest($"Đơn hàng tối thiểu {coupon.MinOrderAmount:N0}₫ để dùng mã này", "coupon_min_order");
        if (coupon.PerUserLimit is { } perUser)
        {
            var used = await db.Orders.CountAsync(o => o.UserId == userId && o.CouponId == coupon.Id && o.Status != OrderStatus.Cancelled);
            if (used >= perUser) throw AppException.BadRequest("Bạn đã dùng hết lượt cho mã này", "coupon_user_limit");
        }
        return coupon;
    }
}
