using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PhoneHub.Api.Contracts;
using PhoneHub.Api.Data;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;

namespace PhoneHub.Api.Services;

public class CartService(AppDbContext db, PricingService pricing, IOptions<ShopOptions> shop, TimeProvider clock)
{
    public async Task<CartDto> GetAsync(int userId)
    {
        var items = await LoadItemsAsync(userId);
        var valid = items.Where(i => i.Issue is null).Select(i => new PriceLine(i.VariantId, i.UnitPrice, i.Quantity)).ToList();
        var price = pricing.Calculate(valid, null);
        return new CartDto(items, items.Sum(i => i.Quantity), price.Subtotal, price.ShippingFee, price.Total, items.Any(i => i.Issue is not null));
    }

    /// <summary>Dòng giỏ hàng với giá hiện hành từ DB và cảnh báo (hết hàng / ngừng bán).</summary>
    public async Task<List<CartItemDto>> LoadItemsAsync(int userId)
    {
        var rows = await db.CartItems
            .Where(ci => ci.Cart.UserId == userId)
            .OrderBy(ci => ci.AddedAt)
            .Select(ci => new
            {
                ci.VariantId, ci.Quantity,
                ci.Variant.ProductId, ProductName = ci.Variant.Product.Name, ProductSlug = ci.Variant.Product.Slug,
                ci.Variant.Color, ci.Variant.StorageGb, ci.Variant.Sku, ci.Variant.Price, ci.Variant.CompareAtPrice,
                Active = ci.Variant.IsActive && ci.Variant.Product.IsActive,
                Stock = ci.Variant.Inventory != null ? ci.Variant.Inventory.Quantity : 0,
                Image = ci.Variant.Product.Images.OrderBy(i => i.Color == ci.Variant.Color ? 0 : 1).ThenBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
            })
            .ToListAsync();

        return rows.Select(r =>
        {
            string? issue = !r.Active ? "Sản phẩm đã ngừng kinh doanh"
                : r.Stock <= 0 ? "Sản phẩm đã hết hàng"
                : r.Stock < r.Quantity ? $"Chỉ còn {r.Stock} sản phẩm"
                : null;
            var variantName = $"{r.Color} · {(r.StorageGb >= 1024 ? $"{r.StorageGb / 1024}TB" : $"{r.StorageGb}GB")}";
            return new CartItemDto(r.VariantId, r.ProductId, r.ProductName, r.ProductSlug, variantName, r.Sku, r.Image,
                r.Price, r.CompareAtPrice, r.Quantity, r.Price * r.Quantity, r.Stock, issue);
        }).ToList();
    }

    public async Task AddAsync(int userId, int variantId, int quantity)
    {
        var variant = await db.ProductVariants
            .Where(v => v.Id == variantId && v.IsActive && v.Product.IsActive)
            .Select(v => new { v.Id, Stock = v.Inventory != null ? v.Inventory.Quantity : 0 })
            .FirstOrDefaultAsync() ?? throw AppException.NotFound("Sản phẩm không tồn tại hoặc đã ngừng bán");

        var cart = await GetOrCreateCartAsync(userId);
        var item = cart.Items.FirstOrDefault(i => i.VariantId == variantId);
        var newQty = (item?.Quantity ?? 0) + quantity;
        EnsureQuantity(newQty, variant.Stock);

        if (item is null) cart.Items.Add(new CartItem { VariantId = variantId, Quantity = newQty, AddedAt = clock.GetUtcNow().UtcDateTime });
        else item.Quantity = newQty;
        cart.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync();
    }

    public async Task UpdateAsync(int userId, int variantId, int quantity)
    {
        var item = await db.CartItems.Include(i => i.Variant).ThenInclude(v => v.Inventory)
                       .FirstOrDefaultAsync(i => i.Cart.UserId == userId && i.VariantId == variantId)
                   ?? throw AppException.NotFound("Sản phẩm không có trong giỏ hàng");
        EnsureQuantity(quantity, item.Variant.Inventory?.Quantity ?? 0);
        item.Quantity = quantity;
        await db.SaveChangesAsync();
    }

    public async Task RemoveAsync(int userId, int variantId) =>
        await db.CartItems.Where(i => i.Cart.UserId == userId && i.VariantId == variantId).ExecuteDeleteAsync();

    public async Task ClearAsync(int userId) =>
        await db.CartItems.Where(i => i.Cart.UserId == userId).ExecuteDeleteAsync();

    private void EnsureQuantity(int quantity, int stock)
    {
        if (quantity > shop.Value.MaxQuantityPerItem)
            throw AppException.BadRequest($"Mỗi sản phẩm tối đa {shop.Value.MaxQuantityPerItem} chiếc / đơn", "max_quantity");
        if (stock <= 0) throw AppException.Conflict("Sản phẩm đã hết hàng", "out_of_stock");
        if (quantity > stock) throw AppException.Conflict($"Chỉ còn {stock} sản phẩm trong kho", "insufficient_stock");
    }

    private async Task<Cart> GetOrCreateCartAsync(int userId)
    {
        var cart = await db.Carts.Include(c => c.Items).FirstOrDefaultAsync(c => c.UserId == userId);
        if (cart is not null) return cart;
        cart = new Cart { UserId = userId };
        db.Carts.Add(cart);
        return cart;
    }
}
