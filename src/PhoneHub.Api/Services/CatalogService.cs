using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PhoneHub.Api.Contracts;
using PhoneHub.Api.Data;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;

namespace PhoneHub.Api.Services;

public class CatalogService(AppDbContext db)
{
    public async Task<ProductListResponse> SearchAsync(ProductQuery q)
    {
        var baseQuery = db.Products.AsNoTracking().Where(p => p.IsActive && p.Brand.IsActive && p.Variants.Any(v => v.IsActive));

        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = $"%{EscapeLike(q.Q.Trim())}%";
            baseQuery = baseQuery.Where(p => EF.Functions.Like(p.Name, term, "\\") || EF.Functions.Like(p.Brand.Name, term, "\\"));
        }
        if (!string.IsNullOrWhiteSpace(q.Category))
            baseQuery = baseQuery.Where(p => p.Category.Slug == q.Category || (p.Category.Parent != null && p.Category.Parent.Slug == q.Category));

        // Facets tính trên tập đã lọc theo từ khóa + danh mục (chưa lọc brand/giá/dung lượng) để người dùng thấy lựa chọn khác.
        var facets = await BuildFacetsAsync(baseQuery);

        var query = baseQuery;
        var brands = SplitList(q.Brand);
        if (brands.Count > 0) query = query.Where(p => brands.Contains(p.Brand.Slug));
        var storages = SplitInts(q.Storage);
        if (storages.Count > 0) query = query.Where(p => p.Variants.Any(v => v.IsActive && storages.Contains(v.StorageGb)));
        var rams = SplitInts(q.Ram);
        if (rams.Count > 0) query = query.Where(p => p.Variants.Any(v => v.IsActive && rams.Contains(v.RamGb)));
        if (q.MinPrice is { } min) query = query.Where(p => p.Variants.Any(v => v.IsActive && v.Price >= min));
        if (q.MaxPrice is { } max) query = query.Where(p => p.Variants.Any(v => v.IsActive && v.Price <= max));
        if (q.Featured == true) query = query.Where(p => p.IsFeatured);
        if (q.OnSale == true) query = query.Where(p => p.Variants.Any(v => v.IsActive && v.CompareAtPrice != null && v.CompareAtPrice > v.Price));

        query = q.Sort switch
        {
            "price_asc" => query.OrderBy(p => p.Variants.Where(v => v.IsActive).Min(v => v.Price)).ThenBy(p => p.Id),
            "price_desc" => query.OrderByDescending(p => p.Variants.Where(v => v.IsActive).Min(v => v.Price)).ThenBy(p => p.Id),
            "rating" => query.OrderByDescending(p => p.RatingAvg).ThenByDescending(p => p.RatingCount).ThenBy(p => p.Id),
            "newest" => query.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id),
            _ => query.OrderByDescending(p => p.IsFeatured).ThenByDescending(p => p.SoldCount).ThenBy(p => p.Id),
        };

        var total = await query.CountAsync();
        var ids = await query.Skip((q.Page - 1) * q.PageSize).Take(q.PageSize).Select(p => p.Id).ToListAsync();
        var cards = await CardsAsync(ids);
        return new ProductListResponse(cards, q.Page, q.PageSize, total, (int)Math.Ceiling(total / (double)q.PageSize), facets);
    }

    /// <summary>Thẻ sản phẩm theo đúng thứ tự <paramref name="ids"/>.</summary>
    public async Task<List<ProductCardDto>> CardsAsync(IReadOnlyCollection<int> ids)
    {
        if (ids.Count == 0) return [];
        var products = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Include(p => p.Brand)
            .Include(p => p.Variants.Where(v => v.IsActive)).ThenInclude(v => v.Inventory)
            .Include(p => p.Images)
            .AsSplitQuery()
            .ToListAsync();
        var byId = products.ToDictionary(p => p.Id);
        return ids.Where(byId.ContainsKey).Select(id => ToCard(byId[id])).ToList();
    }

    public static ProductCardDto ToCard(Product p)
    {
        var cheapest = p.Variants.OrderBy(v => v.Price).FirstOrDefault();
        var image = p.Images.OrderBy(i => i.Color == null ? 0 : 1).ThenBy(i => i.SortOrder).FirstOrDefault()?.Url;
        return new ProductCardDto(p.Id, p.Name, p.Slug, p.Brand.Name, p.Brand.Slug, image,
            cheapest?.Price ?? 0, cheapest?.CompareAtPrice is { } c && c > cheapest.Price ? c : null,
            p.RatingAvg, p.RatingCount,
            p.Variants.Select(v => v.ColorHex).Distinct().ToList(),
            p.Variants.Select(v => v.StorageGb).Distinct().Order().ToList(),
            p.Variants.Any(v => (v.Inventory?.Quantity ?? 0) > 0), p.IsFeatured);
    }

    public async Task<List<ProductCardDto>> SuggestAsync(string q)
    {
        if (string.IsNullOrWhiteSpace(q)) return [];
        var term = $"%{EscapeLike(q.Trim())}%";
        var ids = await db.Products.AsNoTracking()
            .Where(p => p.IsActive && (EF.Functions.Like(p.Name, term, "\\") || EF.Functions.Like(p.Brand.Name, term, "\\")))
            .OrderByDescending(p => p.SoldCount).Take(6).Select(p => p.Id).ToListAsync();
        return await CardsAsync(ids);
    }

    public async Task<ProductDetailDto> GetBySlugAsync(string slug)
    {
        var p = await db.Products.AsNoTracking()
            .Include(x => x.Brand).Include(x => x.Category)
            .Include(x => x.Variants.Where(v => v.IsActive)).ThenInclude(v => v.Inventory)
            .Include(x => x.Images)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Slug == slug && x.IsActive)
            ?? throw AppException.NotFound("Không tìm thấy sản phẩm");

        return new ProductDetailDto(p.Id, p.Name, p.Slug, p.ShortDescription, p.Description,
            new BrandDto(p.Brand.Id, p.Brand.Name, p.Brand.Slug, p.Brand.LogoUrl, p.Brand.Description, 0),
            new CategoryDto(p.Category.Id, p.Category.Name, p.Category.Slug, p.Category.Description, p.Category.ParentId, 0),
            ParseSpecs(p.SpecsJson), p.RatingAvg, p.RatingCount, p.SoldCount, p.IsFeatured,
            p.Variants.OrderBy(v => v.StorageGb).ThenBy(v => v.Color).Select(ToVariantDto).ToList(),
            p.Images.OrderBy(i => i.SortOrder).Select(i => new ImageDto(i.Id, i.Url, i.Alt, i.Color, i.SortOrder)).ToList());
    }

    public async Task<List<CompareItemDto>> CompareAsync(IReadOnlyCollection<int> ids)
    {
        var products = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id) && p.IsActive)
            .Include(p => p.Brand).Include(p => p.Variants.Where(v => v.IsActive)).Include(p => p.Images)
            .AsSplitQuery().ToListAsync();
        return ids.Select(id => products.FirstOrDefault(p => p.Id == id)).OfType<Product>().Select(p => new CompareItemDto(
            p.Id, p.Name, p.Slug, p.Images.OrderBy(i => i.Color == null ? 0 : 1).ThenBy(i => i.SortOrder).FirstOrDefault()?.Url, p.Brand.Name,
            p.Variants.Count == 0 ? 0 : p.Variants.Min(v => v.Price), p.RatingAvg, p.RatingCount,
            p.Variants.OrderBy(v => v.StorageGb).Select(v => v.StorageLabel).Distinct().ToList(),
            p.Variants.Select(v => v.Color).Distinct().ToList(),
            ParseSpecs(p.SpecsJson))).ToList();
    }

    public static VariantDto ToVariantDto(ProductVariant v) =>
        new(v.Id, v.Sku, v.Color, v.ColorHex, v.StorageGb, v.RamGb, v.Price, v.CompareAtPrice, v.Inventory?.Quantity ?? 0, v.IsActive);

    public static Dictionary<string, string> ParseSpecs(string json)
    {
        try { return JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? []; }
        catch (JsonException) { return []; }
    }

    private async Task<ProductFacets> BuildFacetsAsync(IQueryable<Product> q)
    {
        var brands = await q.GroupBy(p => new { p.Brand.Slug, p.Brand.Name })
            .Select(g => new FacetItem(g.Key.Slug, g.Key.Name, g.Count())).ToListAsync();
        var variants = q.SelectMany(p => p.Variants).Where(v => v.IsActive);
        var storages = await variants.GroupBy(v => v.StorageGb)
            .Select(g => new { g.Key, Count = g.Select(v => v.ProductId).Distinct().Count() }).ToListAsync();
        var rams = await variants.GroupBy(v => v.RamGb)
            .Select(g => new { g.Key, Count = g.Select(v => v.ProductId).Distinct().Count() }).ToListAsync();
        var hasAny = await variants.AnyAsync();
        var minPrice = hasAny ? await variants.MinAsync(v => v.Price) : 0;
        var maxPrice = hasAny ? await variants.MaxAsync(v => v.Price) : 0;

        return new ProductFacets(
            brands.OrderBy(b => b.Label).ToList(),
            storages.OrderBy(s => s.Key).Select(s => new FacetItem(s.Key.ToString(), s.Key >= 1024 ? $"{s.Key / 1024}TB" : $"{s.Key}GB", s.Count)).ToList(),
            rams.OrderBy(s => s.Key).Select(s => new FacetItem(s.Key.ToString(), $"{s.Key}GB", s.Count)).ToList(),
            minPrice, maxPrice);
    }

    internal static string EscapeLike(string s) => s.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    private static List<string> SplitList(string? s) =>
        string.IsNullOrWhiteSpace(s) ? [] : s.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(20).ToList();

    private static List<int> SplitInts(string? s) =>
        SplitList(s).Select(x => int.TryParse(x, out var n) ? n : -1).Where(n => n > 0).ToList();
}
