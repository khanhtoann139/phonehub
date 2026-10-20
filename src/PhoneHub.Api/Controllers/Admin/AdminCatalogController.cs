using System.Text.Json;
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
public class AdminCatalogController(AppDbContext db, AuditService audit, TimeProvider clock) : ControllerBase
{
    // ───────────── Brands ─────────────
    [HttpGet("brands")]
    public async Task<IReadOnlyList<AdminBrandDto>> Brands() =>
        await db.Brands.AsNoTracking().OrderBy(b => b.SortOrder).ThenBy(b => b.Name)
            .Select(b => new AdminBrandDto(b.Id, b.Name, b.Slug, b.LogoUrl, b.Description, b.SortOrder, b.IsActive, b.Products.Count))
            .ToListAsync();

    [HttpPost("brands")]
    public async Task<ActionResult<AdminBrandDto>> CreateBrand(BrandRequest req)
    {
        var brand = new Brand();
        await ApplyBrand(brand, req);
        db.Brands.Add(brand);
        await db.SaveChangesAsync();
        await Log("create", "brand", brand.Id, brand.Name);
        return Ok(new AdminBrandDto(brand.Id, brand.Name, brand.Slug, brand.LogoUrl, brand.Description, brand.SortOrder, brand.IsActive, 0));
    }

    [HttpPut("brands/{id:int}")]
    public async Task<AdminBrandDto> UpdateBrand(int id, BrandRequest req)
    {
        var brand = await db.Brands.FindAsync(id) ?? throw AppException.NotFound();
        await ApplyBrand(brand, req);
        await db.SaveChangesAsync();
        await Log("update", "brand", id, brand.Name);
        return new AdminBrandDto(brand.Id, brand.Name, brand.Slug, brand.LogoUrl, brand.Description, brand.SortOrder, brand.IsActive,
            await db.Products.CountAsync(p => p.BrandId == id));
    }

    [HttpDelete("brands/{id:int}")]
    public async Task<IActionResult> DeleteBrand(int id)
    {
        var brand = await db.Brands.FindAsync(id) ?? throw AppException.NotFound();
        if (await db.Products.AnyAsync(p => p.BrandId == id))
            throw AppException.Conflict("Thương hiệu đang có sản phẩm — hãy ẩn thay vì xóa", "in_use");
        db.Brands.Remove(brand);
        await db.SaveChangesAsync();
        await Log("delete", "brand", id, brand.Name);
        return NoContent();
    }

    private async Task ApplyBrand(Brand b, BrandRequest r)
    {
        b.Name = r.Name.Trim();
        b.Slug = string.IsNullOrWhiteSpace(r.Slug) ? Slug.From(r.Name) : r.Slug;
        if (await db.Brands.AnyAsync(x => x.Slug == b.Slug && x.Id != b.Id)) throw AppException.Conflict("Slug đã tồn tại", "duplicate");
        b.LogoUrl = r.LogoUrl;
        b.Description = r.Description;
        b.SortOrder = r.SortOrder;
        b.IsActive = r.IsActive;
    }

    // ───────────── Categories ─────────────
    [HttpGet("categories")]
    public async Task<IReadOnlyList<AdminCategoryDto>> Categories() =>
        await db.Categories.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new AdminCategoryDto(c.Id, c.Name, c.Slug, c.Description, c.ParentId, c.SortOrder, c.IsActive, c.Products.Count))
            .ToListAsync();

    [HttpPost("categories")]
    public async Task<ActionResult<AdminCategoryDto>> CreateCategory(CategoryRequest req)
    {
        var c = new Category();
        await ApplyCategory(c, req);
        db.Categories.Add(c);
        await db.SaveChangesAsync();
        await Log("create", "category", c.Id, c.Name);
        return Ok(new AdminCategoryDto(c.Id, c.Name, c.Slug, c.Description, c.ParentId, c.SortOrder, c.IsActive, 0));
    }

    [HttpPut("categories/{id:int}")]
    public async Task<AdminCategoryDto> UpdateCategory(int id, CategoryRequest req)
    {
        var c = await db.Categories.FindAsync(id) ?? throw AppException.NotFound();
        if (req.ParentId == id) throw AppException.BadRequest("Danh mục cha không hợp lệ");
        await ApplyCategory(c, req);
        await db.SaveChangesAsync();
        await Log("update", "category", id, c.Name);
        return new AdminCategoryDto(c.Id, c.Name, c.Slug, c.Description, c.ParentId, c.SortOrder, c.IsActive, await db.Products.CountAsync(p => p.CategoryId == id));
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var c = await db.Categories.FindAsync(id) ?? throw AppException.NotFound();
        if (await db.Products.AnyAsync(p => p.CategoryId == id) || await db.Categories.AnyAsync(x => x.ParentId == id))
            throw AppException.Conflict("Danh mục đang được sử dụng — hãy ẩn thay vì xóa", "in_use");
        db.Categories.Remove(c);
        await db.SaveChangesAsync();
        await Log("delete", "category", id, c.Name);
        return NoContent();
    }

    private async Task ApplyCategory(Category c, CategoryRequest r)
    {
        c.Name = r.Name.Trim();
        c.Slug = string.IsNullOrWhiteSpace(r.Slug) ? Slug.From(r.Name) : r.Slug;
        if (await db.Categories.AnyAsync(x => x.Slug == c.Slug && x.Id != c.Id)) throw AppException.Conflict("Slug đã tồn tại", "duplicate");
        if (r.ParentId is { } pid)
        {
            if (!await db.Categories.AnyAsync(x => x.Id == pid)) throw AppException.BadRequest("Danh mục cha không tồn tại");
            // Chặn vòng lặp: cha mới không được là chính nó hoặc hậu duệ của nó.
            var parents = await db.Categories.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.ParentId);
            for (int? cur = pid; cur is not null; cur = parents.GetValueOrDefault(cur.Value))
                if (cur == c.Id && c.Id != 0) throw AppException.BadRequest("Không thể chọn danh mục con làm danh mục cha");
        }
        c.Description = r.Description;
        c.ParentId = r.ParentId;
        c.SortOrder = r.SortOrder;
        c.IsActive = r.IsActive;
    }

    // ───────────── Products ─────────────
    [HttpGet("products")]
    public async Task<Paged<AdminProductRowDto>> Products([FromQuery] AdminListQuery q, [FromQuery] int? brandId, [FromQuery] int? categoryId)
    {
        var query = db.Products.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = $"%{CatalogService.EscapeLike(q.Q.Trim())}%";
            query = query.Where(p => EF.Functions.Like(p.Name, term, "\\") || p.Variants.Any(v => EF.Functions.Like(v.Sku, term, "\\")));
        }
        if (brandId is not null) query = query.Where(p => p.BrandId == brandId);
        if (categoryId is not null) query = query.Where(p => p.CategoryId == categoryId);
        if (q.Status == "active") query = query.Where(p => p.IsActive);
        if (q.Status == "inactive") query = query.Where(p => !p.IsActive);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(p => p.UpdatedAt).Skip((q.Page - 1) * q.PageSize).Take(q.PageSize)
            .Select(p => new AdminProductRowDto(p.Id, p.Name, p.Slug, p.Brand.Name, p.Category.Name,
                p.Variants.Min(v => (decimal?)v.Price) ?? 0, p.Variants.Max(v => (decimal?)v.Price) ?? 0,
                p.Variants.Sum(v => v.Inventory != null ? v.Inventory.Quantity : 0), p.Variants.Count, p.IsActive, p.IsFeatured,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(), p.UpdatedAt))
            .ToListAsync();
        return new Paged<AdminProductRowDto>(items, q.Page, q.PageSize, total);
    }

    [HttpGet("products/{id:int}")]
    public async Task<AdminProductDto> Product(int id)
    {
        var p = await db.Products.AsNoTracking()
            .Include(x => x.Variants).ThenInclude(v => v.Inventory).Include(x => x.Images)
            .AsSplitQuery().FirstOrDefaultAsync(x => x.Id == id) ?? throw AppException.NotFound();
        return ToAdminDto(p);
    }

    [HttpPost("products")]
    public async Task<ActionResult<AdminProductDto>> CreateProduct(ProductRequest req)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var p = new Product { CreatedAt = now };
        await using var tx = await db.Database.BeginTransactionAsync();
        await ApplyProduct(p, req, now);
        db.Products.Add(p);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        await Log("create", "product", p.Id, p.Name);
        return Ok(await Product(p.Id));
    }

    [HttpPut("products/{id:int}")]
    public async Task<AdminProductDto> UpdateProduct(int id, ProductRequest req)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var p = await db.Products.Include(x => x.Variants).ThenInclude(v => v.Inventory).Include(x => x.Images)
            .AsSplitQuery().FirstOrDefaultAsync(x => x.Id == id) ?? throw AppException.NotFound();
        await using var tx = await db.Database.BeginTransactionAsync();
        await ApplyProduct(p, req, now);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        await Log("update", "product", id, p.Name);
        return await Product(id);
    }

    [HttpDelete("products/{id:int}")]
    public async Task<IActionResult> DeleteProduct(int id)
    {
        var p = await db.Products.FindAsync(id) ?? throw AppException.NotFound();
        if (await db.OrderItems.AnyAsync(i => i.ProductId == id))
        {
            // Đã có đơn hàng tham chiếu → chỉ ẩn (soft delete) để giữ lịch sử.
            p.IsActive = false;
            p.UpdatedAt = clock.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync();
            await Log("deactivate", "product", id, p.Name);
            return Ok(new { softDeleted = true, message = "Sản phẩm đã có đơn hàng nên được chuyển sang ẩn" });
        }
        db.Products.Remove(p);
        await db.SaveChangesAsync();
        await Log("delete", "product", id, p.Name);
        return NoContent();
    }

    private async Task ApplyProduct(Product p, ProductRequest r, DateTime now)
    {
        if (!await db.Brands.AnyAsync(b => b.Id == r.BrandId)) throw AppException.BadRequest("Thương hiệu không tồn tại");
        if (!await db.Categories.AnyAsync(c => c.Id == r.CategoryId)) throw AppException.BadRequest("Danh mục không tồn tại");

        p.Name = r.Name.Trim();
        p.Slug = string.IsNullOrWhiteSpace(r.Slug) ? Slug.From(r.Name) : r.Slug;
        if (await db.Products.AnyAsync(x => x.Slug == p.Slug && x.Id != p.Id)) throw AppException.Conflict("Slug sản phẩm đã tồn tại", "duplicate");
        p.BrandId = r.BrandId;
        p.CategoryId = r.CategoryId;
        p.ShortDescription = r.ShortDescription?.Trim() ?? "";
        p.Description = r.Description ?? "";
        p.SpecsJson = JsonSerializer.Serialize(r.Specs ?? new Dictionary<string, string>());
        p.IsActive = r.IsActive;
        p.IsFeatured = r.IsFeatured;
        p.UpdatedAt = now;

        // Biến thể: khớp theo Id; biến thể bị bỏ khỏi danh sách → xóa nếu chưa có đơn, ngược lại ẩn.
        var dupSku = r.Variants.GroupBy(v => v.Sku.Trim().ToUpperInvariant()).FirstOrDefault(g => g.Count() > 1);
        if (dupSku is not null) throw AppException.BadRequest($"SKU {dupSku.Key} bị trùng");
        var dupCombo = r.Variants.GroupBy(v => (v.Color.Trim().ToLowerInvariant(), v.StorageGb)).FirstOrDefault(g => g.Count() > 1);
        if (dupCombo is not null) throw AppException.BadRequest($"Biến thể {dupCombo.Key.Item1} {dupCombo.Key.StorageGb}GB bị trùng");

        var skus = r.Variants.Select(v => v.Sku.Trim().ToUpperInvariant()).ToList();
        var keepIds = r.Variants.Where(v => v.Id is not null).Select(v => v.Id!.Value).ToHashSet();
        if (await db.ProductVariants.AnyAsync(v => skus.Contains(v.Sku) && v.ProductId != p.Id))
            throw AppException.Conflict("SKU đã được dùng cho sản phẩm khác", "duplicate");

        foreach (var removed in p.Variants.Where(v => !keepIds.Contains(v.Id)).ToList())
        {
            if (await db.OrderItems.AnyAsync(i => i.VariantId == removed.Id)) removed.IsActive = false;
            else p.Variants.Remove(removed);
        }

        foreach (var input in r.Variants)
        {
            var v = input.Id is { } vid ? p.Variants.FirstOrDefault(x => x.Id == vid) ?? throw AppException.BadRequest($"Biến thể #{vid} không thuộc sản phẩm") : null;
            if (v is null) { v = new ProductVariant(); p.Variants.Add(v); }
            v.Sku = input.Sku.Trim().ToUpperInvariant();
            v.Color = input.Color.Trim();
            v.ColorHex = input.ColorHex;
            v.StorageGb = input.StorageGb;
            v.RamGb = input.RamGb;
            v.Price = input.Price;
            v.CompareAtPrice = input.CompareAtPrice is { } c && c > input.Price ? c : null;
            v.IsActive = input.IsActive;
            v.Inventory ??= new Inventory();
            v.Inventory.Quantity = input.Stock;
            v.Inventory.UpdatedAt = now;
        }

        if (r.Images is not null)
        {
            p.Images.Clear();
            foreach (var (img, i) in r.Images.Select((x, i) => (x, i)))
                p.Images.Add(new ProductImage { Url = img.Url, Alt = img.Alt ?? p.Name, Color = string.IsNullOrWhiteSpace(img.Color) ? null : img.Color, SortOrder = img.SortOrder == 0 ? i : img.SortOrder });
        }
    }

    private static AdminProductDto ToAdminDto(Product p) => new(p.Id, p.Name, p.Slug, p.BrandId, p.CategoryId, p.ShortDescription, p.Description,
        CatalogService.ParseSpecs(p.SpecsJson), p.IsActive, p.IsFeatured,
        p.Variants.OrderBy(v => v.StorageGb).ThenBy(v => v.Color).Select(CatalogService.ToVariantDto).ToList(),
        p.Images.OrderBy(i => i.SortOrder).Select(i => new ImageDto(i.Id, i.Url, i.Alt, i.Color, i.SortOrder)).ToList());

    // ───────────── Inventory ─────────────
    [HttpGet("inventory")]
    public async Task<Paged<InventoryRowDto>> Inventory([FromQuery] AdminListQuery q)
    {
        var query = db.Inventory.AsNoTracking().Where(i => i.Variant.IsActive);
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = $"%{CatalogService.EscapeLike(q.Q.Trim())}%";
            query = query.Where(i => EF.Functions.Like(i.Variant.Sku, term, "\\") || EF.Functions.Like(i.Variant.Product.Name, term, "\\"));
        }
        if (q.Status == "low") query = query.Where(i => i.Quantity <= i.LowStockThreshold);
        if (q.Status == "out") query = query.Where(i => i.Quantity == 0);
        var total = await query.CountAsync();
        var rows = await query.OrderBy(i => i.Quantity).ThenBy(i => i.Variant.Sku).Skip((q.Page - 1) * q.PageSize).Take(q.PageSize)
            .Select(i => new { i.VariantId, i.Variant.Sku, ProductName = i.Variant.Product.Name, i.Variant.Color, i.Variant.StorageGb, i.Quantity, i.LowStockThreshold, i.UpdatedAt })
            .ToListAsync();
        return new Paged<InventoryRowDto>(rows.Select(r => new InventoryRowDto(r.VariantId, r.Sku, r.ProductName,
            $"{r.Color} · {(r.StorageGb >= 1024 ? $"{r.StorageGb / 1024}TB" : $"{r.StorageGb}GB")}", r.Quantity, r.LowStockThreshold, r.Quantity <= r.LowStockThreshold, r.UpdatedAt)).ToList(),
            q.Page, q.PageSize, total);
    }

    [HttpPut("inventory/{variantId:int}")]
    public async Task<IActionResult> UpdateInventory(int variantId, UpdateInventoryRequest req)
    {
        var inv = await db.Inventory.FindAsync(variantId) ?? throw AppException.NotFound();
        var before = inv.Quantity;
        inv.Quantity = req.Quantity;
        inv.LowStockThreshold = req.LowStockThreshold;
        inv.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync();
        await Log("adjust_stock", "inventory", variantId, $"{before}->{req.Quantity}");
        return NoContent();
    }

    private Task Log(string action, string entity, int id, string? data) =>
        audit.LogAsync(User.GetUserId(), action, entity, id.ToString(), data, HttpContext.ClientIp());
}
