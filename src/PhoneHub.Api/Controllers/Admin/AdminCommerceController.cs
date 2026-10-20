using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PhoneHub.Api.Contracts;
using PhoneHub.Api.Data;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;
using PhoneHub.Api.Services;

namespace PhoneHub.Api.Controllers.Admin;

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin")]
public class AdminCommerceController(AppDbContext db, OrderService orders, AuditService audit, TimeProvider clock, IWebHostEnvironment env) : ControllerBase
{
    private static readonly string[] RevenueExcluded = [OrderStatus.Cancelled, OrderStatus.AwaitingPayment];

    // ───────────── Dashboard ─────────────
    [HttpGet("dashboard")]
    public async Task<DashboardResponse> Dashboard([FromQuery] int days = 30)
    {
        days = Math.Clamp(days, 1, 365);
        var now = clock.GetUtcNow().UtcDateTime;
        var from = now.Date.AddDays(-(days - 1));
        var prevFrom = from.AddDays(-days);

        var orderRows = await db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= prevFrom && !RevenueExcluded.Contains(o.Status))
            .Select(o => new { o.CreatedAt, o.Total }).ToListAsync();
        var cur = orderRows.Where(o => o.CreatedAt >= from).ToList();
        var prev = orderRows.Where(o => o.CreatedAt < from).ToList();

        var newCustomers = await db.Users.CountAsync(u => u.Role == Roles.Customer && u.CreatedAt >= from);
        var newCustomersPrev = await db.Users.CountAsync(u => u.Role == Roles.Customer && u.CreatedAt >= prevFrom && u.CreatedAt < from);
        var lowStockCount = await db.Inventory.CountAsync(i => i.Variant.IsActive && i.Quantity <= i.LowStockThreshold);
        var pending = await db.Orders.CountAsync(o => o.Status == OrderStatus.Pending);

        var revenue = cur.Sum(o => o.Total);
        var kpi = new DashboardKpi(revenue, prev.Sum(o => o.Total), cur.Count, prev.Count, newCustomers, newCustomersPrev,
            cur.Count == 0 ? 0 : Math.Round(revenue / cur.Count), lowStockCount, pending);

        var byDay = Enumerable.Range(0, days).Select(i => from.AddDays(i)).Select(d =>
        {
            var dayRows = cur.Where(o => o.CreatedAt.Date == d).ToList();
            return new RevenuePoint(d.ToString("yyyy-MM-dd"), dayRows.Sum(o => o.Total), dayRows.Count);
        }).ToList();

        var byStatus = await db.Orders.AsNoTracking().Where(o => o.CreatedAt >= from)
            .GroupBy(o => o.Status).Select(g => new StatusCount(g.Key, g.Count())).ToListAsync();

        var topRows = await db.OrderItems.AsNoTracking()
            .Where(i => i.Order.CreatedAt >= from && !RevenueExcluded.Contains(i.Order.Status))
            .Select(i => new { i.ProductId, i.ProductName, i.Quantity, i.LineTotal }).ToListAsync();
        var top = topRows.GroupBy(i => i.ProductId)
            .Select(g => new TopProduct(g.Key, g.First().ProductName, g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal)))
            .OrderByDescending(t => t.Revenue).Take(5).ToList();

        var lowStock = (await db.Inventory.AsNoTracking().Where(i => i.Variant.IsActive && i.Quantity <= i.LowStockThreshold)
                .OrderBy(i => i.Quantity).Take(6)
                .Select(i => new { i.VariantId, i.Variant.Sku, ProductName = i.Variant.Product.Name, i.Variant.Color, i.Variant.StorageGb, i.Quantity, i.LowStockThreshold, i.UpdatedAt })
                .ToListAsync())
            .Select(r => new InventoryRowDto(r.VariantId, r.Sku, r.ProductName, $"{r.Color} · {(r.StorageGb >= 1024 ? $"{r.StorageGb / 1024}TB" : $"{r.StorageGb}GB")}",
                r.Quantity, r.LowStockThreshold, r.Quantity <= r.LowStockThreshold, r.UpdatedAt)).ToList();

        var recent = await OrderService.ProjectSummary(db.Orders.AsNoTracking().OrderByDescending(o => o.CreatedAt).Take(6)).ToListAsync();
        return new DashboardResponse(kpi, byDay, byStatus, top, lowStock, recent);
    }

    // ───────────── Orders ─────────────
    [HttpGet("orders")]
    public async Task<Paged<object>> Orders([FromQuery] AdminListQuery q)
    {
        var query = db.Orders.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(o => o.Status == q.Status);
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = $"%{CatalogService.EscapeLike(q.Q.Trim())}%";
            query = query.Where(o => EF.Functions.Like(o.Code, term, "\\") || EF.Functions.Like(o.User.Email, term, "\\")
                                     || EF.Functions.Like(o.ShipName, term, "\\") || EF.Functions.Like(o.ShipPhone, term, "\\"));
        }
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(o => o.CreatedAt).Skip((q.Page - 1) * q.PageSize).Take(q.PageSize)
            .Select(o => (object)new
            {
                o.Code, o.Status, o.PaymentMethod, o.PaymentStatus, o.Total, o.ShipName, o.ShipPhone, CustomerEmail = o.User.Email,
                ItemCount = o.Items.Sum(i => i.Quantity), o.CreatedAt,
            }).ToListAsync();
        return new Paged<object>(items, q.Page, q.PageSize, total);
    }

    [HttpGet("orders/{code}")]
    public Task<OrderDetailDto> Order(string code) => orders.GetDetailAsync(code, null);

    [HttpPut("orders/{code}/status")]
    public Task<OrderDetailDto> UpdateOrderStatus(string code, UpdateOrderStatusRequest req)
    {
        if (!OrderStatus.All.Contains(req.Status)) throw AppException.BadRequest("Trạng thái không hợp lệ");
        return orders.UpdateStatusByAdminAsync(User.GetUserId(), code, req.Status, req.Reason, HttpContext.ClientIp());
    }

    // ───────────── Coupons ─────────────
    [HttpGet("coupons")]
    public async Task<IReadOnlyList<CouponDto>> Coupons() =>
        (await db.Coupons.AsNoTracking().OrderByDescending(c => c.CreatedAt).ToListAsync()).Select(ToDto).ToList();

    [HttpPost("coupons")]
    public async Task<ActionResult<CouponDto>> CreateCoupon(CouponRequest req)
    {
        var c = new Coupon { CreatedAt = clock.GetUtcNow().UtcDateTime };
        await ApplyCoupon(c, req);
        db.Coupons.Add(c);
        await db.SaveChangesAsync();
        await Log("create", "coupon", c.Id.ToString(), c.Code);
        return Ok(ToDto(c));
    }

    [HttpPut("coupons/{id:int}")]
    public async Task<CouponDto> UpdateCoupon(int id, CouponRequest req)
    {
        var c = await db.Coupons.FindAsync(id) ?? throw AppException.NotFound();
        await ApplyCoupon(c, req);
        await db.SaveChangesAsync();
        await Log("update", "coupon", id.ToString(), c.Code);
        return ToDto(c);
    }

    [HttpDelete("coupons/{id:int}")]
    public async Task<IActionResult> DeleteCoupon(int id)
    {
        var c = await db.Coupons.FindAsync(id) ?? throw AppException.NotFound();
        if (await db.Orders.AnyAsync(o => o.CouponId == id))
        {
            c.IsActive = false;
            await db.SaveChangesAsync();
            await Log("deactivate", "coupon", id.ToString(), c.Code);
            return Ok(new { softDeleted = true, message = "Mã đã được dùng trong đơn hàng nên được chuyển sang tắt" });
        }
        db.Coupons.Remove(c);
        await db.SaveChangesAsync();
        await Log("delete", "coupon", id.ToString(), c.Code);
        return NoContent();
    }

    private async Task ApplyCoupon(Coupon c, CouponRequest r)
    {
        if (r.EndsAt <= r.StartsAt) throw AppException.BadRequest("Ngày kết thúc phải sau ngày bắt đầu");
        if (r.Type == "percent" && r.Value > 100) throw AppException.BadRequest("Phần trăm giảm tối đa 100");
        var code = r.Code.Trim().ToUpperInvariant();
        if (await db.Coupons.AnyAsync(x => x.Code == code && x.Id != c.Id)) throw AppException.Conflict("Mã giảm giá đã tồn tại", "duplicate");
        c.Code = code;
        c.Description = r.Description?.Trim() ?? "";
        c.Type = r.Type == "percent" ? CouponType.Percent : CouponType.Fixed;
        c.Value = r.Value;
        c.MaxDiscount = r.MaxDiscount is > 0 ? r.MaxDiscount : null;
        c.MinOrderAmount = r.MinOrderAmount;
        c.StartsAt = DateTime.SpecifyKind(r.StartsAt.ToUniversalTime(), DateTimeKind.Utc);
        c.EndsAt = DateTime.SpecifyKind(r.EndsAt.ToUniversalTime(), DateTimeKind.Utc);
        c.UsageLimit = r.UsageLimit;
        c.PerUserLimit = r.PerUserLimit;
        c.IsActive = r.IsActive;
        c.IsPublic = r.IsPublic;
    }

    private static CouponDto ToDto(Coupon c) => new(c.Id, c.Code, c.Description, c.Type == CouponType.Percent ? "percent" : "fixed", c.Value, c.MaxDiscount,
        c.MinOrderAmount, c.StartsAt, c.EndsAt, c.UsageLimit, c.UsedCount, c.PerUserLimit, c.IsActive, c.IsPublic);

    // ───────────── Users ─────────────
    [HttpGet("users")]
    public async Task<Paged<AdminUserDto>> Users([FromQuery] AdminListQuery q)
    {
        var query = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = $"%{CatalogService.EscapeLike(q.Q.Trim())}%";
            query = query.Where(u => EF.Functions.Like(u.Email, term, "\\") || EF.Functions.Like(u.FullName, term, "\\") || (u.Phone != null && EF.Functions.Like(u.Phone, term, "\\")));
        }
        if (q.Status is Roles.Admin or Roles.Customer) query = query.Where(u => u.Role == q.Status);
        var total = await query.CountAsync();
        var users = await query.OrderByDescending(u => u.CreatedAt).Skip((q.Page - 1) * q.PageSize).Take(q.PageSize)
            .Select(u => new AdminUserDto(u.Id, u.Email, u.FullName, u.Phone, u.Role, u.IsActive, u.CreatedAt,
                db.Orders.Count(o => o.UserId == u.Id),
                db.Orders.Where(o => o.UserId == u.Id && !RevenueExcluded.Contains(o.Status)).Sum(o => (decimal?)o.Total) ?? 0))
            .ToListAsync();
        return new Paged<AdminUserDto>(users, q.Page, q.PageSize, total);
    }

    [HttpPut("users/{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, UpdateUserRequest req)
    {
        if (id == User.GetUserId()) throw AppException.BadRequest("Không thể tự đổi quyền hoặc khóa chính mình");
        var u = await db.Users.FindAsync(id) ?? throw AppException.NotFound();
        u.Role = req.Role;
        u.IsActive = req.IsActive;
        u.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        if (!req.IsActive)
        {
            var now = u.UpdatedAt;
            await db.RefreshTokens.Where(t => t.UserId == id && t.RevokedAt == null).ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));
        }
        await db.SaveChangesAsync();
        await Log("update", "user", id.ToString(), $"role={req.Role};active={req.IsActive}");
        return NoContent();
    }

    // ───────────── Reviews ─────────────
    [HttpGet("reviews")]
    public async Task<Paged<AdminReviewDto>> Reviews([FromQuery] AdminListQuery q)
    {
        var query = db.Reviews.AsNoTracking();
        if (q.Status == "approved") query = query.Where(r => r.IsApproved);
        if (q.Status == "hidden") query = query.Where(r => !r.IsApproved);
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = $"%{CatalogService.EscapeLike(q.Q.Trim())}%";
            query = query.Where(r => EF.Functions.Like(r.Product.Name, term, "\\") || EF.Functions.Like(r.Content, term, "\\"));
        }
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(r => r.CreatedAt).Skip((q.Page - 1) * q.PageSize).Take(q.PageSize)
            .Select(r => new AdminReviewDto(r.Id, r.ProductId, r.Product.Name, r.User.FullName, r.User.Email, r.Rating, r.Title, r.Content, r.IsApproved, r.IsVerifiedPurchase, r.CreatedAt))
            .ToListAsync();
        return new Paged<AdminReviewDto>(items, q.Page, q.PageSize, total);
    }

    [HttpPut("reviews/{id:int}")]
    public async Task<IActionResult> UpdateReview(int id, UpdateReviewRequest req)
    {
        var r = await db.Reviews.FindAsync(id) ?? throw AppException.NotFound();
        r.IsApproved = req.IsApproved;
        await db.SaveChangesAsync();
        await CatalogController.RecalculateRating(db, r.ProductId);
        await Log(req.IsApproved ? "approve" : "hide", "review", id.ToString(), null);
        return NoContent();
    }

    [HttpDelete("reviews/{id:int}")]
    public async Task<IActionResult> DeleteReview(int id)
    {
        var r = await db.Reviews.FindAsync(id) ?? throw AppException.NotFound();
        db.Reviews.Remove(r);
        await db.SaveChangesAsync();
        await CatalogController.RecalculateRating(db, r.ProductId);
        await Log("delete", "review", id.ToString(), null);
        return NoContent();
    }

    // ───────────── Contacts & audit ─────────────
    [HttpGet("contacts")]
    public async Task<Paged<ContactDto>> Contacts([FromQuery] AdminListQuery q)
    {
        var query = db.ContactMessages.AsNoTracking();
        if (q.Status == "open") query = query.Where(c => !c.IsHandled);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(c => c.CreatedAt).Skip((q.Page - 1) * q.PageSize).Take(q.PageSize)
            .Select(c => new ContactDto(c.Id, c.Name, c.Email, c.Phone, c.Subject, c.Message, c.IsHandled, c.CreatedAt)).ToListAsync();
        return new Paged<ContactDto>(items, q.Page, q.PageSize, total);
    }

    [HttpPut("contacts/{id:int}/handled")]
    public async Task<IActionResult> MarkHandled(int id)
    {
        var affected = await db.ContactMessages.Where(c => c.Id == id).ExecuteUpdateAsync(s => s.SetProperty(c => c.IsHandled, true));
        if (affected == 0) throw AppException.NotFound();
        return NoContent();
    }

    [HttpGet("audit-logs")]
    public async Task<Paged<AuditLogDto>> AuditLogs([FromQuery] AdminListQuery q)
    {
        var query = db.AuditLogs.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Q)) query = query.Where(a => a.Action == q.Q || a.Entity == q.Q || a.EntityId == q.Q);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(a => a.Id).Skip((q.Page - 1) * q.PageSize).Take(q.PageSize)
            .Select(a => new AuditLogDto(a.Id, a.UserId, db.Users.Where(u => u.Id == a.UserId).Select(u => u.Email).FirstOrDefault(),
                a.Action, a.Entity, a.EntityId, a.Data, a.Ip, a.CreatedAt)).ToListAsync();
        return new Paged<AuditLogDto>(items, q.Page, q.PageSize, total);
    }

    // ───────────── Upload ảnh ─────────────
    [HttpPost("uploads")]
    [RequestSizeLimit(2 * 1024 * 1024 + 64 * 1024)]
    public async Task<object> Upload(IFormFile file)
    {
        if (file is null || file.Length == 0) throw AppException.BadRequest("Chưa chọn file");
        if (file.Length > 2 * 1024 * 1024) throw AppException.BadRequest("Ảnh tối đa 2MB");

        var header = new byte[12];
        await using (var s = file.OpenReadStream()) _ = await s.ReadAsync(header);
        var ext = DetectImage(header) ?? throw AppException.BadRequest("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP");

        var dir = Path.Combine(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"), "uploads");
        Directory.CreateDirectory(dir);
        var name = $"{Guid.NewGuid():N}{ext}";
        await using (var fs = System.IO.File.Create(Path.Combine(dir, name))) await file.CopyToAsync(fs);
        await Log("upload", "image", name, null);
        return new { url = $"/uploads/{name}" };
    }

    internal static string? DetectImage(ReadOnlySpan<byte> h)
    {
        if (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return ".jpg";
        if (h.Length >= 8 && h[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return ".png";
        if (h.Length >= 12 && h[..4].SequenceEqual("RIFF"u8) && h[8..12].SequenceEqual("WEBP"u8)) return ".webp";
        return null;
    }

    private Task Log(string action, string entity, string id, string? data) =>
        audit.LogAsync(User.GetUserId(), action, entity, id, data, HttpContext.ClientIp());
}
