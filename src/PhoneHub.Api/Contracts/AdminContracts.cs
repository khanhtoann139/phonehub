using System.ComponentModel.DataAnnotations;

namespace PhoneHub.Api.Contracts;

public class AdminListQuery
{
    [MaxLength(100)] public string? Q { get; set; }
    [MaxLength(30)] public string? Status { get; set; }
    [Range(1, 10_000)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
}

public record BrandRequest(
    [Required(ErrorMessage = "Vui lòng nhập tên"), StringLength(100, MinimumLength = 1)] string Name,
    [MaxLength(120), RegularExpression("^[a-z0-9-]*$", ErrorMessage = "Slug chỉ gồm a-z, 0-9, -")] string? Slug,
    [MaxLength(500)] string? LogoUrl,
    [MaxLength(1000)] string? Description,
    int SortOrder,
    bool IsActive = true);

public record CategoryRequest(
    [Required(ErrorMessage = "Vui lòng nhập tên"), StringLength(100, MinimumLength = 1)] string Name,
    [MaxLength(120), RegularExpression("^[a-z0-9-]*$", ErrorMessage = "Slug chỉ gồm a-z, 0-9, -")] string? Slug,
    [MaxLength(1000)] string? Description,
    int? ParentId,
    int SortOrder,
    bool IsActive = true);

public record AdminBrandDto(int Id, string Name, string Slug, string? LogoUrl, string? Description, int SortOrder, bool IsActive, int ProductCount);
public record AdminCategoryDto(int Id, string Name, string Slug, string? Description, int? ParentId, int SortOrder, bool IsActive, int ProductCount);

public record VariantInput(
    int? Id,
    [Required, MaxLength(64), RegularExpression("^[A-Za-z0-9-_]+$", ErrorMessage = "SKU chỉ gồm chữ, số, -, _")] string Sku,
    [Required, MaxLength(60)] string Color,
    [Required, RegularExpression("^#[0-9A-Fa-f]{6}$", ErrorMessage = "Mã màu dạng #RRGGBB")] string ColorHex,
    [Range(1, 4096)] int StorageGb,
    [Range(1, 64)] int RamGb,
    [Range(1000, 1_000_000_000, ErrorMessage = "Giá không hợp lệ")] decimal Price,
    [Range(0, 1_000_000_000)] decimal? CompareAtPrice,
    [Range(0, 1_000_000)] int Stock,
    bool IsActive = true);

public record ImageInput([Required, MaxLength(500)] string Url, [MaxLength(200)] string? Alt, [MaxLength(60)] string? Color, int SortOrder);

public record ProductRequest(
    [Required(ErrorMessage = "Vui lòng nhập tên"), StringLength(200, MinimumLength = 2)] string Name,
    [MaxLength(220), RegularExpression("^[a-z0-9-]*$")] string? Slug,
    [Range(1, int.MaxValue, ErrorMessage = "Chọn thương hiệu")] int BrandId,
    [Range(1, int.MaxValue, ErrorMessage = "Chọn danh mục")] int CategoryId,
    [MaxLength(500)] string? ShortDescription,
    [MaxLength(20000)] string? Description,
    Dictionary<string, string>? Specs,
    bool IsActive,
    bool IsFeatured,
    [Required, MinLength(1, ErrorMessage = "Cần ít nhất một biến thể")] List<VariantInput> Variants,
    List<ImageInput>? Images);

public record AdminProductRowDto(int Id, string Name, string Slug, string BrandName, string CategoryName, decimal MinPrice, decimal MaxPrice, int TotalStock, int VariantCount, bool IsActive, bool IsFeatured, string? ImageUrl, DateTime UpdatedAt);

public record AdminProductDto(int Id, string Name, string Slug, int BrandId, int CategoryId, string ShortDescription, string Description,
    Dictionary<string, string> Specs, bool IsActive, bool IsFeatured, IReadOnlyList<VariantDto> Variants, IReadOnlyList<ImageDto> Images);

public record InventoryRowDto(int VariantId, string Sku, string ProductName, string VariantName, int Quantity, int LowStockThreshold, bool IsLow, DateTime UpdatedAt);
public record UpdateInventoryRequest([Range(0, 1_000_000)] int Quantity, [Range(0, 10_000)] int LowStockThreshold);

public record CouponRequest(
    [Required, StringLength(40, MinimumLength = 3), RegularExpression("^[A-Za-z0-9_-]+$", ErrorMessage = "Mã chỉ gồm chữ, số, -, _")] string Code,
    [MaxLength(255)] string? Description,
    [Required, RegularExpression("^(percent|fixed)$")] string Type,
    [Range(1, 1_000_000_000)] decimal Value,
    [Range(0, 1_000_000_000)] decimal? MaxDiscount,
    [Range(0, 1_000_000_000)] decimal MinOrderAmount,
    DateTime StartsAt,
    DateTime EndsAt,
    [Range(1, 1_000_000)] int? UsageLimit,
    [Range(1, 1000)] int? PerUserLimit,
    bool IsActive,
    bool IsPublic);

public record CouponDto(int Id, string Code, string Description, string Type, decimal Value, decimal? MaxDiscount, decimal MinOrderAmount,
    DateTime StartsAt, DateTime EndsAt, int? UsageLimit, int UsedCount, int? PerUserLimit, bool IsActive, bool IsPublic);

public record UpdateOrderStatusRequest([Required] string Status, [MaxLength(255)] string? Reason);

public record AdminUserDto(int Id, string Email, string FullName, string? Phone, string Role, bool IsActive, DateTime CreatedAt, int OrderCount, decimal TotalSpent);
public record UpdateUserRequest([Required, RegularExpression("^(customer|admin)$")] string Role, bool IsActive);

public record AdminReviewDto(int Id, int ProductId, string ProductName, string AuthorName, string AuthorEmail, int Rating, string? Title, string Content, bool IsApproved, bool IsVerifiedPurchase, DateTime CreatedAt);
public record UpdateReviewRequest(bool IsApproved);

public record ContactDto(int Id, string Name, string Email, string? Phone, string Subject, string Message, bool IsHandled, DateTime CreatedAt);
public record AuditLogDto(long Id, int? UserId, string? UserEmail, string Action, string Entity, string? EntityId, string? Data, string? Ip, DateTime CreatedAt);

public record DashboardKpi(decimal Revenue, decimal RevenuePrev, int Orders, int OrdersPrev, int NewCustomers, int NewCustomersPrev, decimal AvgOrderValue, int LowStockCount, int PendingOrders);
public record RevenuePoint(string Date, decimal Revenue, int Orders);
public record StatusCount(string Status, int Count);
public record TopProduct(int ProductId, string Name, int Quantity, decimal Revenue);
public record DashboardResponse(DashboardKpi Kpi, IReadOnlyList<RevenuePoint> RevenueByDay, IReadOnlyList<StatusCount> OrdersByStatus, IReadOnlyList<TopProduct> TopProducts, IReadOnlyList<InventoryRowDto> LowStock, IReadOnlyList<OrderSummaryDto> RecentOrders);
