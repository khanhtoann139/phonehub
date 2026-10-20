namespace PhoneHub.Api.Domain;

public class Brand
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? LogoUrl { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public List<Product> Products { get; set; } = [];
}

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? Description { get; set; }
    public int? ParentId { get; set; }
    public Category? Parent { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public List<Product> Products { get; set; } = [];
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public int BrandId { get; set; }
    public Brand Brand { get; set; } = null!;
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public string ShortDescription { get; set; } = "";
    public string Description { get; set; } = "";
    /// <summary>JSON object { "Màn hình": "...", "Chip": "..." } — dùng cho trang chi tiết & so sánh.</summary>
    public string SpecsJson { get; set; } = "{}";
    public bool IsActive { get; set; } = true;
    public bool IsFeatured { get; set; }
    public decimal RatingAvg { get; set; }
    public int RatingCount { get; set; }
    public int SoldCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<ProductVariant> Variants { get; set; } = [];
    public List<ProductImage> Images { get; set; } = [];
}

public class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string Sku { get; set; } = "";
    public string Color { get; set; } = "";
    public string ColorHex { get; set; } = "#000000";
    public int StorageGb { get; set; }
    public int RamGb { get; set; }
    public decimal Price { get; set; }
    /// <summary>Giá gốc (gạch ngang) — &gt; Price nghĩa là đang giảm giá.</summary>
    public decimal? CompareAtPrice { get; set; }
    public bool IsActive { get; set; } = true;
    public Inventory? Inventory { get; set; }

    public string DisplayName => $"{Color} · {StorageLabel}";
    public string StorageLabel => StorageGb >= 1024 ? $"{StorageGb / 1024}TB" : $"{StorageGb}GB";
}

public class ProductImage
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    /// <summary>Null = ảnh chung; có giá trị = ảnh của màu đó.</summary>
    public string? Color { get; set; }
    public string Url { get; set; } = "";
    public string Alt { get; set; } = "";
    public int SortOrder { get; set; }
}

public class Inventory
{
    public int VariantId { get; set; }
    public ProductVariant Variant { get; set; } = null!;
    public int Quantity { get; set; }
    public int LowStockThreshold { get; set; } = 5;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
