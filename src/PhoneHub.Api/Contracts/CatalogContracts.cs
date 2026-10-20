using System.ComponentModel.DataAnnotations;

namespace PhoneHub.Api.Contracts;

public record BrandDto(int Id, string Name, string Slug, string? LogoUrl, string? Description, int ProductCount);
public record CategoryDto(int Id, string Name, string Slug, string? Description, int? ParentId, int ProductCount);

public class ProductQuery
{
    [MaxLength(100)] public string? Q { get; set; }
    /// <summary>Slug thương hiệu, nhiều giá trị cách nhau dấu phẩy.</summary>
    [MaxLength(300)] public string? Brand { get; set; }
    [MaxLength(120)] public string? Category { get; set; }
    [Range(0, 1_000_000_000)] public decimal? MinPrice { get; set; }
    [Range(0, 1_000_000_000)] public decimal? MaxPrice { get; set; }
    /// <summary>Dung lượng GB, nhiều giá trị cách dấu phẩy.</summary>
    [MaxLength(100)] public string? Storage { get; set; }
    [MaxLength(100)] public string? Ram { get; set; }
    public bool? Featured { get; set; }
    public bool? OnSale { get; set; }
    [RegularExpression("^(newest|price_asc|price_desc|rating|popular)$")] public string? Sort { get; set; }
    [Range(1, 10_000)] public int Page { get; set; } = 1;
    [Range(1, 48)] public int PageSize { get; set; } = 12;
}

public record ProductCardDto(
    int Id, string Name, string Slug, string BrandName, string BrandSlug, string? ImageUrl,
    decimal Price, decimal? CompareAtPrice, decimal RatingAvg, int RatingCount,
    IReadOnlyList<string> Colors, IReadOnlyList<int> Storages, bool InStock, bool IsFeatured);

public record FacetItem(string Value, string Label, int Count);
public record ProductFacets(IReadOnlyList<FacetItem> Brands, IReadOnlyList<FacetItem> Storages, IReadOnlyList<FacetItem> Rams, decimal MinPrice, decimal MaxPrice);

public record ProductListResponse(IReadOnlyList<ProductCardDto> Items, int Page, int PageSize, int Total, int TotalPages, ProductFacets Facets);

public record VariantDto(int Id, string Sku, string Color, string ColorHex, int StorageGb, int RamGb, decimal Price, decimal? CompareAtPrice, int Stock, bool IsActive);
public record ImageDto(int Id, string Url, string Alt, string? Color, int SortOrder);

public record ProductDetailDto(
    int Id, string Name, string Slug, string ShortDescription, string Description,
    BrandDto Brand, CategoryDto Category, Dictionary<string, string> Specs,
    decimal RatingAvg, int RatingCount, int SoldCount, bool IsFeatured,
    IReadOnlyList<VariantDto> Variants, IReadOnlyList<ImageDto> Images);

public record CompareItemDto(int Id, string Name, string Slug, string? ImageUrl, string BrandName, decimal MinPrice, decimal RatingAvg, int RatingCount,
    IReadOnlyList<string> Storages, IReadOnlyList<string> Colors, Dictionary<string, string> Specs);

public record ReviewDto(int Id, int Rating, string? Title, string Content, string AuthorName, bool IsVerifiedPurchase, DateTime CreatedAt);
public record ReviewListResponse(IReadOnlyList<ReviewDto> Items, int Page, int PageSize, int Total, int TotalPages, decimal Average, int Count, int[] Distribution, bool CanReview, bool HasReviewed);

public record CreateReviewRequest(
    [Range(1, 5, ErrorMessage = "Chọn từ 1 đến 5 sao")] int Rating,
    [MaxLength(150)] string? Title,
    [Required(ErrorMessage = "Vui lòng nhập nội dung"), StringLength(2000, MinimumLength = 10, ErrorMessage = "Nội dung tối thiểu 10 ký tự")] string Content);

public record PublicCouponDto(string Code, string Description, string Type, decimal Value, decimal? MaxDiscount, decimal MinOrderAmount, DateTime EndsAt);
public record PromotionsResponse(IReadOnlyList<PublicCouponDto> Coupons, IReadOnlyList<ProductCardDto> SaleProducts);
