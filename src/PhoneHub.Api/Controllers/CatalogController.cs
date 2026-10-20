using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using PhoneHub.Api.Contracts;
using PhoneHub.Api.Data;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;
using PhoneHub.Api.Services;

namespace PhoneHub.Api.Controllers;

[ApiController]
[Route("api")]
public class CatalogController(AppDbContext db, CatalogService catalog, TimeProvider clock) : ControllerBase
{
    [HttpGet("brands")]
    [ResponseCache(Duration = 60)]
    public async Task<IReadOnlyList<BrandDto>> Brands() =>
        await db.Brands.AsNoTracking().Where(b => b.IsActive).OrderBy(b => b.SortOrder).ThenBy(b => b.Name)
            .Select(b => new BrandDto(b.Id, b.Name, b.Slug, b.LogoUrl, b.Description, b.Products.Count(p => p.IsActive)))
            .ToListAsync();

    [HttpGet("categories")]
    [ResponseCache(Duration = 60)]
    public async Task<IReadOnlyList<CategoryDto>> Categories() =>
        await db.Categories.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Slug, c.Description, c.ParentId, c.Products.Count(p => p.IsActive)))
            .ToListAsync();

    [HttpGet("products")]
    public Task<ProductListResponse> Products([FromQuery] ProductQuery query) => catalog.SearchAsync(query);

    [HttpGet("products/suggest")]
    public Task<List<ProductCardDto>> Suggest([FromQuery] string? q) => catalog.SuggestAsync((q ?? "").Length > 100 ? q![..100] : q ?? "");

    [HttpGet("products/compare")]
    public async Task<ActionResult<List<CompareItemDto>>> Compare([FromQuery] string ids)
    {
        var list = (ids ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => int.TryParse(s, out var n) ? n : 0).Where(n => n > 0).Distinct().Take(4).ToList();
        if (list.Count == 0) throw AppException.BadRequest("Chọn ít nhất một sản phẩm để so sánh");
        return await catalog.CompareAsync(list);
    }

    [HttpGet("products/{slug}")]
    public Task<ProductDetailDto> Detail(string slug) => catalog.GetBySlugAsync(slug);

    [HttpGet("products/{id:int}/reviews")]
    public async Task<ReviewListResponse> Reviews(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 5)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 20);
        var q = db.Reviews.AsNoTracking().Where(r => r.ProductId == id && r.IsApproved);
        var total = await q.CountAsync();
        var counts = await q.GroupBy(r => r.Rating).Select(g => new { g.Key, Count = g.Count() }).ToListAsync();
        var dist = Enumerable.Range(1, 5).Select(star => counts.FirstOrDefault(c => c.Key == star)?.Count ?? 0).ToArray();
        var avg = total == 0 ? 0 : Math.Round((decimal)counts.Sum(c => c.Key * c.Count) / total, 1);
        var items = await q.OrderByDescending(r => r.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(r => new ReviewDto(r.Id, r.Rating, r.Title, r.Content, r.User.FullName, r.IsVerifiedPurchase, r.CreatedAt))
            .ToListAsync();

        bool canReview = false, hasReviewed = false;
        if (User.TryGetUserId() is { } uid)
        {
            hasReviewed = await db.Reviews.AnyAsync(r => r.ProductId == id && r.UserId == uid);
            canReview = !hasReviewed && await HasDeliveredPurchase(uid, id);
        }
        return new ReviewListResponse(items, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize), avg, total, dist, canReview, hasReviewed);
    }

    [Authorize]
    [HttpPost("products/{id:int}/reviews")]
    [EnableRateLimiting("write")]
    public async Task<ActionResult<ReviewDto>> CreateReview(int id, CreateReviewRequest req)
    {
        var uid = User.GetUserId();
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && p.IsActive) ?? throw AppException.NotFound("Không tìm thấy sản phẩm");
        if (await db.Reviews.AnyAsync(r => r.ProductId == id && r.UserId == uid))
            throw AppException.Conflict("Bạn đã đánh giá sản phẩm này", "already_reviewed");
        if (!await HasDeliveredPurchase(uid, id))
            throw AppException.Forbidden("Chỉ khách đã mua và nhận hàng mới có thể đánh giá");

        var review = new Review
        {
            ProductId = id, UserId = uid, Rating = req.Rating, Title = req.Title?.Trim(), Content = req.Content.Trim(),
            IsApproved = true, IsVerifiedPurchase = true, CreatedAt = clock.GetUtcNow().UtcDateTime,
        };
        db.Reviews.Add(review);
        await db.SaveChangesAsync();
        await RecalculateRating(db, id);
        var name = await db.Users.Where(u => u.Id == uid).Select(u => u.FullName).FirstAsync();
        return Created($"/api/products/{id}/reviews", new ReviewDto(review.Id, review.Rating, review.Title, review.Content, name, true, review.CreatedAt));
    }

    [HttpGet("promotions")]
    public async Task<PromotionsResponse> Promotions()
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var coupons = await db.Coupons.AsNoTracking()
            .Where(c => c.IsActive && c.IsPublic && c.StartsAt <= now && c.EndsAt >= now && (c.UsageLimit == null || c.UsedCount < c.UsageLimit))
            .OrderBy(c => c.EndsAt)
            .Select(c => new PublicCouponDto(c.Code, c.Description, c.Type == CouponType.Percent ? "percent" : "fixed", c.Value, c.MaxDiscount, c.MinOrderAmount, c.EndsAt))
            .ToListAsync();
        var sale = await catalog.SearchAsync(new ProductQuery { OnSale = true, PageSize = 12, Sort = "popular" });
        return new PromotionsResponse(coupons, sale.Items);
    }

    [HttpPost("contact")]
    [EnableRateLimiting("write")]
    public async Task<IActionResult> Contact(ContactRequest req)
    {
        db.ContactMessages.Add(new ContactMessage
        {
            Name = req.Name.Trim(), Email = req.Email.Trim(), Phone = req.Phone?.Trim(), Subject = req.Subject.Trim(),
            Message = req.Message.Trim(), CreatedAt = clock.GetUtcNow().UtcDateTime,
        });
        await db.SaveChangesAsync();
        return Accepted(new { message = "Cảm ơn bạn! PhoneHub sẽ phản hồi trong vòng 24 giờ." });
    }

    private Task<bool> HasDeliveredPurchase(int userId, int productId) =>
        db.OrderItems.AnyAsync(i => i.ProductId == productId && i.Order.UserId == userId && i.Order.Status == OrderStatus.Delivered);

    internal static async Task RecalculateRating(AppDbContext db, int productId)
    {
        var stats = await db.Reviews.Where(r => r.ProductId == productId && r.IsApproved)
            .GroupBy(_ => 1).Select(g => new { Count = g.Count(), Sum = g.Sum(r => r.Rating) }).FirstOrDefaultAsync();
        var count = stats?.Count ?? 0;
        var avg = count == 0 ? 0 : Math.Round((decimal)stats!.Sum / count, 2);
        await db.Products.Where(p => p.Id == productId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.RatingAvg, avg).SetProperty(p => p.RatingCount, count));
    }
}
