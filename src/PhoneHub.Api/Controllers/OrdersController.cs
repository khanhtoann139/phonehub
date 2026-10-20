using System.Globalization;
using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PhoneHub.Api.Contracts;
using PhoneHub.Api.Data;
using PhoneHub.Api.Infrastructure;
using PhoneHub.Api.Payments;
using PhoneHub.Api.Services;

namespace PhoneHub.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class OrdersController(OrderService orders, AppDbContext db) : ControllerBase
{
    [HttpPost("checkout/preview")]
    public Task<CheckoutPreviewResponse> Preview(CheckoutPreviewRequest req) => orders.PreviewAsync(User.GetUserId(), req.CouponCode);

    [HttpPost("orders")]
    [EnableRateLimiting("write")]
    public async Task<ActionResult<PlaceOrderResponse>> Place(PlaceOrderRequest req)
    {
        var result = await orders.PlaceAsync(User.GetUserId(), req, HttpContext.ClientIp());
        return Created($"/api/orders/{result.Order.Code}", result);
    }

    [HttpGet("orders")]
    public async Task<Paged<OrderSummaryDto>> List([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);
        var q = db.Orders.AsNoTracking().Where(o => o.UserId == User.GetUserId());
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(o => o.Status == status);
        var total = await q.CountAsync();
        var items = await OrderService.ProjectSummary(q.OrderByDescending(o => o.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)).ToListAsync();
        return new Paged<OrderSummaryDto>(items, page, pageSize, total);
    }

    [HttpGet("orders/{code}")]
    public Task<OrderDetailDto> Detail(string code) => orders.GetDetailAsync(code, User.GetUserId());

    [HttpPost("orders/{code}/cancel")]
    public Task<OrderDetailDto> Cancel(string code, CancelOrderRequest req) =>
        orders.CancelByCustomerAsync(User.GetUserId(), code, req.Reason, HttpContext.ClientIp());

    [HttpPost("orders/{code}/pay")]
    [EnableRateLimiting("write")]
    public async Task<object> Pay(string code) =>
        new { paymentUrl = await orders.RetryPaymentAsync(User.GetUserId(), code, HttpContext.ClientIp()) };
}

[ApiController]
[Route("api/payments")]
public class PaymentsController(PaymentGatewayRegistry gateways, OrderService orders, AppDbContext db, IOptions<ShopOptions> shop) : ControllerBase
{
    [HttpGet("methods")]
    public IEnumerable<PaymentMethodDto> Methods() =>
        gateways.Enabled.Select(g => new PaymentMethodDto(g.Code, g.Name, g.Description, g.IsOnline));

    /// <summary>Cổng trả khách về (redirect trình duyệt) → cập nhật đơn rồi chuyển sang trang kết quả của frontend.</summary>
    [HttpGet("{provider}/return")]
    public async Task<IActionResult> Return(string provider)
    {
        var gateway = gateways.Get(provider);
        if (!gateway.IsOnline) return NotFound();
        var (ok, code, message) = await orders.HandleCallbackAsync(provider, gateway.ParseCallback(Request.Query), HttpContext.ClientIp());
        var url = $"{shop.Value.FrontendUrl.TrimEnd('/')}/payment/result?status={(ok ? "success" : "failed")}" +
                  $"&order={WebUtility.UrlEncode(code ?? "")}&message={WebUtility.UrlEncode(message)}";
        return Redirect(url);
    }

    /// <summary>IPN server-to-server của VNPay.</summary>
    [HttpGet("vnpay/ipn")]
    public async Task<object> VnPayIpn()
    {
        var gateway = gateways.Get("vnpay");
        var cb = gateway.ParseCallback(Request.Query);
        if (!cb.SignatureValid) return new { RspCode = "97", Message = "Invalid signature" };
        var (ok, code, _) = await orders.HandleCallbackAsync("vnpay", cb, HttpContext.ClientIp());
        if (code is null) return new { RspCode = "01", Message = "Order not found" };
        return new { RspCode = "00", Message = ok ? "Confirm Success" : "Confirm Received" };
    }

    /// <summary>Trang cổng giả lập (chỉ khi bật provider "sandbox").</summary>
    [HttpGet("sandbox/checkout")]
    public async Task<IActionResult> SandboxCheckout([FromQuery(Name = "ref")] string txnRef, [FromQuery] string amount, [FromQuery] string sig)
    {
        if (gateways.Get("sandbox") is not SandboxGateway sandbox || !sandbox.VerifyCheckout(txnRef, amount, sig))
            return BadRequest("Liên kết thanh toán không hợp lệ");
        var payment = await db.Payments.AsNoTracking().Include(p => p.Order).FirstOrDefaultAsync(p => p.TxnRef == txnRef);
        if (payment is null) return NotFound();

        var amountText = decimal.Parse(amount, CultureInfo.InvariantCulture).ToString("N0", CultureInfo.GetCultureInfo("vi-VN"));
        var success = WebUtility.HtmlEncode(sandbox.BuildResultUrl(txnRef, amount, "success"));
        var fail = WebUtility.HtmlEncode(sandbox.BuildResultUrl(txnRef, amount, "failed"));
        var html = $$"""
            <!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Cổng thanh toán Sandbox</title>
            <style>body{font-family:system-ui,sans-serif;background:#eef4ff;display:grid;place-items:center;min-height:100vh;margin:0}
            .card{background:#fff;border-radius:16px;padding:32px;max-width:420px;width:90%;box-shadow:0 10px 40px #1d4ed822}
            h1{font-size:20px;margin:0 0 4px;color:#1d4ed8}.muted{color:#64748b;font-size:14px}.amt{font-size:32px;font-weight:700;margin:16px 0}
            a{display:block;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:12px}
            .ok{background:#2563eb;color:#fff}.no{background:#f1f5f9;color:#0f172a}.warn{background:#fef9c3;padding:10px;border-radius:8px;font-size:13px;margin-top:16px}</style>
            </head><body><main class="card"><h1>PhoneHub Sandbox Pay</h1>
            <div class="muted">Đơn hàng {{WebUtility.HtmlEncode(payment.Order.Code)}} · Mã GD {{WebUtility.HtmlEncode(txnRef)}}</div>
            <div class="amt">{{amountText}} ₫</div>
            <a class="ok" href="{{success}}">Xác nhận thanh toán thành công</a>
            <a class="no" href="{{fail}}">Mô phỏng thanh toán thất bại</a>
            <p class="warn">Đây là cổng thử nghiệm — không nhập và không lưu bất kỳ thông tin thẻ nào.</p></main></body></html>
            """;
        Response.Headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'";
        return Content(html, "text/html; charset=utf-8");
    }
}
