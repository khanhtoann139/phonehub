using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PhoneHub.Api.Contracts;
using PhoneHub.Api.Data;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;
using PhoneHub.Api.Payments;

namespace PhoneHub.Api.Services;

public class OrderService(
    AppDbContext db, CartService carts, PricingService pricing, CouponService coupons, PaymentGatewayRegistry gateways,
    AuditService audit, IOptions<PaymentOptions> paymentOptions, TimeProvider clock, ILogger<OrderService> logger)
{
    public async Task<CheckoutPreviewResponse> PreviewAsync(int userId, string? couponCode)
    {
        var items = await carts.LoadItemsAsync(userId);
        var lines = items.Where(i => i.Issue is null).Select(i => new PriceLine(i.VariantId, i.UnitPrice, i.Quantity)).ToList();
        var subtotal = lines.Sum(l => l.LineTotal);

        Coupon? coupon = null;
        string? message = null;
        if (!string.IsNullOrWhiteSpace(couponCode))
        {
            try { coupon = await coupons.ValidateAsync(couponCode, userId, subtotal); message = coupon.Description; }
            catch (AppException ex) { message = ex.Message; }
        }
        var p = pricing.Calculate(lines, coupon);
        return new CheckoutPreviewResponse(items, p.Subtotal, p.DiscountAmount, p.ShippingFee, p.Total, coupon?.Code ?? couponCode?.Trim().ToUpperInvariant(), message, coupon is not null);
    }

    public async Task<PlaceOrderResponse> PlaceAsync(int userId, PlaceOrderRequest req, string? ip)
    {
        var gateway = gateways.Get(req.PaymentMethod);
        var now = clock.GetUtcNow().UtcDateTime;

        // 1. Địa chỉ giao hàng
        string shipName, shipPhone, shipAddress;
        if (req.AddressId is { } addressId)
        {
            var a = await db.Addresses.FirstOrDefaultAsync(x => x.Id == addressId && x.UserId == userId)
                    ?? throw AppException.BadRequest("Địa chỉ giao hàng không hợp lệ", "address_invalid");
            (shipName, shipPhone, shipAddress) = (a.RecipientName, a.Phone, FormatAddress(a.Line1, a.Ward, a.District, a.Province));
        }
        else if (req.Address is { } input)
        {
            (shipName, shipPhone, shipAddress) = (input.RecipientName.Trim(), input.Phone.Trim(), FormatAddress(input.Line1, input.Ward, input.District, input.Province));
            if (input.SaveToAddressBook)
            {
                var hasAny = await db.Addresses.AnyAsync(x => x.UserId == userId);
                db.Addresses.Add(new Address
                {
                    UserId = userId, RecipientName = shipName, Phone = shipPhone, Line1 = input.Line1.Trim(), Ward = input.Ward?.Trim() ?? "",
                    District = input.District.Trim(), Province = input.Province.Trim(), IsDefault = !hasAny,
                });
            }
        }
        else throw AppException.BadRequest("Vui lòng chọn hoặc nhập địa chỉ giao hàng", "address_required");

        // 2. Giỏ hàng + giá hiện hành từ DB
        var items = await carts.LoadItemsAsync(userId);
        if (items.Count == 0) throw AppException.BadRequest("Giỏ hàng trống", "cart_empty");
        if (items.FirstOrDefault(i => i.Issue is not null) is { } bad)
            throw AppException.Conflict($"{bad.ProductName} ({bad.VariantName}): {bad.Issue}", "cart_invalid");

        var lines = items.Select(i => new PriceLine(i.VariantId, i.UnitPrice, i.Quantity)).ToList();
        var subtotal = lines.Sum(l => l.LineTotal);
        var coupon = string.IsNullOrWhiteSpace(req.CouponCode) ? null : await coupons.ValidateAsync(req.CouponCode, userId, subtotal);
        var price = pricing.Calculate(lines, coupon);

        await using var tx = await db.Database.BeginTransactionAsync();

        // 3. Trừ kho nguyên tử: UPDATE … WHERE quantity >= n — hai đơn đồng thời không thể cùng lấy món cuối.
        foreach (var item in items)
        {
            var qty = item.Quantity;
            var affected = await db.Inventory
                .Where(inv => inv.VariantId == item.VariantId && inv.Quantity >= qty)
                .ExecuteUpdateAsync(s => s.SetProperty(inv => inv.Quantity, inv => inv.Quantity - qty).SetProperty(inv => inv.UpdatedAt, now));
            if (affected == 0)
                throw AppException.Conflict($"{item.ProductName} ({item.VariantName}) không đủ hàng", "insufficient_stock");
        }

        if (coupon is not null)
        {
            var ok = await db.Coupons
                .Where(c => c.Id == coupon.Id && (c.UsageLimit == null || c.UsedCount < c.UsageLimit))
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount + 1));
            if (ok == 0) throw AppException.BadRequest("Mã giảm giá đã hết lượt sử dụng", "coupon_exhausted");
        }

        var order = new Order
        {
            Code = NewOrderCode(now),
            UserId = userId,
            Status = gateway.IsOnline ? OrderStatus.AwaitingPayment : OrderStatus.Pending,
            PaymentMethod = gateway.Code,
            PaymentStatus = gateway.IsOnline ? PaymentStatus.Pending : PaymentStatus.Unpaid,
            Subtotal = price.Subtotal,
            DiscountAmount = price.DiscountAmount,
            ShippingFee = price.ShippingFee,
            Total = price.Total,
            CouponId = coupon?.Id,
            CouponCode = coupon?.Code,
            ShipName = shipName, ShipPhone = shipPhone, ShipAddress = shipAddress,
            Note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim(),
            CreatedAt = now, UpdatedAt = now,
            Items = items.Select(i => new OrderItem
            {
                VariantId = i.VariantId, ProductId = i.ProductId, ProductName = i.ProductName, ProductSlug = i.ProductSlug,
                VariantName = i.VariantName, Sku = i.Sku, ImageUrl = i.ImageUrl, UnitPrice = i.UnitPrice, Quantity = i.Quantity, LineTotal = i.LineTotal,
            }).ToList(),
        };
        var payment = new Payment { Provider = gateway.Code, Amount = order.Total, Status = PaymentStatus.Pending, TxnRef = $"{order.Code}-1", CreatedAt = now };
        order.Payments.Add(payment);
        db.Orders.Add(order);

        foreach (var g in items.GroupBy(i => i.ProductId))
        {
            var sold = g.Sum(i => i.Quantity);
            await db.Products.Where(p => p.Id == g.Key).ExecuteUpdateAsync(s => s.SetProperty(p => p.SoldCount, p => p.SoldCount + sold));
        }

        await db.SaveChangesAsync();
        await db.CartItems.Where(ci => ci.Cart.UserId == userId).ExecuteDeleteAsync();
        await tx.CommitAsync();

        await audit.LogAsync(userId, "place_order", "order", order.Code, $"total={order.Total};method={order.PaymentMethod}", ip);
        var url = gateway.CreatePaymentUrl(payment, order, ip);
        return new PlaceOrderResponse(await GetDetailAsync(order.Code, userId), url);
    }

    public async Task<string> RetryPaymentAsync(int userId, string code, string? ip)
    {
        var order = await db.Orders.Include(o => o.Payments).FirstOrDefaultAsync(o => o.Code == code && o.UserId == userId)
                    ?? throw AppException.NotFound("Không tìm thấy đơn hàng");
        if (order.Status != OrderStatus.AwaitingPayment) throw AppException.BadRequest("Đơn hàng không ở trạng thái chờ thanh toán");
        var gateway = gateways.Get(order.PaymentMethod);
        var payment = new Payment
        {
            Provider = gateway.Code, Amount = order.Total, Status = PaymentStatus.Pending,
            TxnRef = $"{order.Code}-{order.Payments.Count + 1}", CreatedAt = clock.GetUtcNow().UtcDateTime,
        };
        order.Payments.Add(payment);
        await db.SaveChangesAsync();
        return gateway.CreatePaymentUrl(payment, order, ip) ?? throw AppException.BadRequest("Phương thức này không cần thanh toán online");
    }

    /// <summary>Xử lý kết quả từ cổng: xác thực chữ ký, đối chiếu số tiền, idempotent.</summary>
    public async Task<(bool Ok, string? OrderCode, string Message)> HandleCallbackAsync(string provider, PaymentCallback cb, string? ip)
    {
        if (!cb.SignatureValid)
        {
            logger.LogWarning("Invalid payment signature from {Provider} for {TxnRef} ({Ip})", provider, cb.TxnRef, ip);
            return (false, null, "Chữ ký không hợp lệ");
        }

        var payment = await db.Payments.Include(p => p.Order).FirstOrDefaultAsync(p => p.TxnRef == cb.TxnRef && p.Provider == provider);
        if (payment is null) return (false, null, "Không tìm thấy giao dịch");
        var order = payment.Order;

        if (payment.Status == PaymentStatus.Paid) return (true, order.Code, "Giao dịch đã được ghi nhận");
        if (cb.Amount != payment.Amount)
        {
            payment.Status = PaymentStatus.Failed;
            payment.ResponseCode = "AMOUNT";
            await db.SaveChangesAsync();
            await audit.LogAsync(null, "payment_amount_mismatch", "payment", payment.TxnRef, $"expected={payment.Amount};got={cb.Amount}", ip);
            return (false, order.Code, "Số tiền thanh toán không khớp");
        }

        var now = clock.GetUtcNow().UtcDateTime;
        payment.ProviderTxnId = cb.ProviderTxnId;
        payment.ResponseCode = cb.ResponseCode;
        if (cb.Success)
        {
            payment.Status = PaymentStatus.Paid;
            payment.PaidAt = now;
            order.PaymentStatus = PaymentStatus.Paid;
            if (order.Status == OrderStatus.AwaitingPayment) order.Status = OrderStatus.Pending;
            else if (order.Status == OrderStatus.Cancelled)
                await audit.LogAsync(null, "payment_after_cancel", "order", order.Code, "Cần hoàn tiền thủ công", ip);
            order.UpdatedAt = now;
            await db.SaveChangesAsync();
            await audit.LogAsync(order.UserId, "payment_success", "order", order.Code, $"provider={provider};txn={cb.ProviderTxnId}", ip);
            return (true, order.Code, "Thanh toán thành công");
        }

        payment.Status = PaymentStatus.Failed;
        order.UpdatedAt = now;
        await db.SaveChangesAsync();
        return (false, order.Code, "Thanh toán không thành công");
    }

    public async Task<OrderDetailDto> CancelByCustomerAsync(int userId, string code, string? reason, string? ip)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Code == code && o.UserId == userId) ?? throw AppException.NotFound("Không tìm thấy đơn hàng");
        if (order.Status is not (OrderStatus.Pending or OrderStatus.AwaitingPayment))
            throw AppException.BadRequest("Đơn hàng đã được xác nhận, vui lòng liên hệ CSKH để hủy", "cannot_cancel");
        if (order.PaymentStatus == PaymentStatus.Paid)
            throw AppException.BadRequest("Đơn đã thanh toán online, vui lòng liên hệ CSKH để hủy và hoàn tiền", "cannot_cancel_paid");
        await CancelAsync(order, reason ?? "Khách hàng hủy");
        await audit.LogAsync(userId, "cancel_order", "order", code, reason, ip);
        return await GetDetailAsync(code, userId);
    }

    public async Task<OrderDetailDto> UpdateStatusByAdminAsync(int adminId, string code, string status, string? reason, string? ip)
    {
        var order = await db.Orders.Include(o => o.Payments).FirstOrDefaultAsync(o => o.Code == code) ?? throw AppException.NotFound("Không tìm thấy đơn hàng");
        if (!OrderStatus.CanTransition(order.Status, status))
            throw AppException.BadRequest($"Không thể chuyển đơn từ {order.Status} sang {status}", "invalid_transition");

        var from = order.Status;
        if (status == OrderStatus.Cancelled) await CancelAsync(order, reason ?? "Cửa hàng hủy");
        else
        {
            order.Status = status;
            order.UpdatedAt = clock.GetUtcNow().UtcDateTime;
            if (status == OrderStatus.Delivered && order.PaymentMethod == "cod")
            {
                order.PaymentStatus = PaymentStatus.Paid;
                foreach (var p in order.Payments.Where(p => p.Status == PaymentStatus.Pending)) { p.Status = PaymentStatus.Paid; p.PaidAt = order.UpdatedAt; }
            }
            await db.SaveChangesAsync();
        }
        await audit.LogAsync(adminId, "update_order_status", "order", code, $"{from}->{status}", ip);
        return await GetDetailAsync(code, null);
    }

    /// <summary>Hủy đơn chờ thanh toán quá hạn (gọi định kỳ bởi <see cref="OrderExpiryWorker"/>).</summary>
    public async Task<int> ExpireAwaitingPaymentAsync()
    {
        var cutoff = clock.GetUtcNow().UtcDateTime.AddMinutes(-paymentOptions.Value.PendingTimeoutMinutes);
        var stale = await db.Orders.Where(o => o.Status == OrderStatus.AwaitingPayment && o.CreatedAt < cutoff).ToListAsync();
        foreach (var o in stale) await CancelAsync(o, "Quá hạn thanh toán");
        return stale.Count;
    }

    private async Task CancelAsync(Order order, string reason)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        await using var tx = await db.Database.BeginTransactionAsync();
        var items = await db.OrderItems.Where(i => i.OrderId == order.Id).ToListAsync();
        foreach (var i in items.Where(i => i.VariantId is not null))
        {
            var qty = i.Quantity;
            await db.Inventory.Where(inv => inv.VariantId == i.VariantId)
                .ExecuteUpdateAsync(s => s.SetProperty(inv => inv.Quantity, inv => inv.Quantity + qty).SetProperty(inv => inv.UpdatedAt, now));
        }
        foreach (var g in items.GroupBy(i => i.ProductId))
        {
            var sold = g.Sum(i => i.Quantity);
            await db.Products.Where(p => p.Id == g.Key && p.SoldCount >= sold).ExecuteUpdateAsync(s => s.SetProperty(p => p.SoldCount, p => p.SoldCount - sold));
        }
        if (order.CouponId is { } couponId)
            await db.Coupons.Where(c => c.Id == couponId && c.UsedCount > 0).ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount - 1));

        order.Status = OrderStatus.Cancelled;
        order.CancelReason = reason;
        order.UpdatedAt = now;
        if (order.PaymentStatus is PaymentStatus.Pending or PaymentStatus.Unpaid) order.PaymentStatus = PaymentStatus.Failed;
        await db.Payments.Where(p => p.OrderId == order.Id && p.Status == PaymentStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, PaymentStatus.Failed));
        await db.SaveChangesAsync();
        await tx.CommitAsync();
    }

    public async Task<OrderDetailDto> GetDetailAsync(string code, int? userId)
    {
        var q = db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.Payments).Include(o => o.User).Where(o => o.Code == code);
        if (userId is not null) q = q.Where(o => o.UserId == userId);
        var o = await q.FirstOrDefaultAsync() ?? throw AppException.NotFound("Không tìm thấy đơn hàng");
        var online = gateways.Enabled.Any(g => g.Code == o.PaymentMethod && g.IsOnline);
        return new OrderDetailDto(o.Code, o.Status, o.PaymentMethod, o.PaymentStatus, o.Subtotal, o.DiscountAmount, o.ShippingFee, o.Total, o.CouponCode,
            o.ShipName, o.ShipPhone, o.ShipAddress, o.Note, o.CancelReason, o.CreatedAt, o.UpdatedAt,
            o.Items.Select(i => new OrderItemDto(i.VariantId, i.ProductId, i.ProductName, i.ProductSlug, i.VariantName, i.Sku, i.ImageUrl, i.UnitPrice, i.Quantity, i.LineTotal)).ToList(),
            o.Payments.OrderBy(p => p.CreatedAt).Select(p => new PaymentDto(p.Provider, p.Amount, p.Status, p.TxnRef, p.CreatedAt, p.PaidAt)).ToList(),
            CanCancel: o.Status is OrderStatus.Pending or OrderStatus.AwaitingPayment && o.PaymentStatus != PaymentStatus.Paid,
            CanPay: o.Status == OrderStatus.AwaitingPayment && online,
            CustomerEmail: o.User.Email, CustomerName: o.User.FullName);
    }

    public static IQueryable<OrderSummaryDto> ProjectSummary(IQueryable<Order> q) => q.Select(o => new OrderSummaryDto(
        o.Code, o.Status, o.PaymentMethod, o.PaymentStatus, o.Total, o.Items.Sum(i => i.Quantity),
        o.Items.OrderBy(i => i.Id).Select(i => i.ProductName).FirstOrDefault(),
        o.Items.OrderBy(i => i.Id).Select(i => i.ImageUrl).FirstOrDefault(), o.CreatedAt));

    private static string FormatAddress(string line1, string? ward, string district, string province) =>
        string.Join(", ", new[] { line1, ward, district, province }.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s!.Trim()));

    private static string NewOrderCode(DateTime now)
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        Span<char> suffix = stackalloc char[6];
        for (var i = 0; i < suffix.Length; i++) suffix[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        return $"PH{now:yyMMdd}{suffix}";
    }
}

public class OrderExpiryWorker(IServiceScopeFactory scopes, ILogger<OrderExpiryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var count = await scope.ServiceProvider.GetRequiredService<OrderService>().ExpireAwaitingPaymentAsync();
                if (count > 0) logger.LogInformation("Expired {Count} unpaid orders", count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Order expiry job failed");
            }
        }
    }
}
