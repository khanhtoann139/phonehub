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
[Authorize]
[Route("api/account")]
public class AccountController(AppDbContext db, AuthService auth, TimeProvider clock) : ControllerBase
{
    [HttpGet("profile")]
    public async Task<UserDto> Profile() =>
        AuthService.ToDto(await db.Users.AsNoTracking().FirstAsync(u => u.Id == User.GetUserId()));

    [HttpPut("profile")]
    public async Task<UserDto> UpdateProfile(UpdateProfileRequest req)
    {
        var user = await db.Users.FirstAsync(u => u.Id == User.GetUserId());
        user.FullName = req.FullName.Trim();
        user.Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone.Trim();
        user.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync();
        return AuthService.ToDto(user);
    }

    [HttpPost("change-password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
    {
        await auth.ChangePasswordAsync(User.GetUserId(), req, HttpContext.ClientIp());
        return NoContent();
    }

    [HttpGet("addresses")]
    public async Task<IReadOnlyList<AddressDto>> Addresses() =>
        await db.Addresses.AsNoTracking().Where(a => a.UserId == User.GetUserId())
            .OrderByDescending(a => a.IsDefault).ThenByDescending(a => a.Id).Select(a => ToDto(a)).ToListAsync();

    [HttpPost("addresses")]
    public async Task<ActionResult<AddressDto>> CreateAddress(AddressRequest req)
    {
        var uid = User.GetUserId();
        if (await db.Addresses.CountAsync(a => a.UserId == uid) >= 10)
            throw AppException.BadRequest("Tối đa 10 địa chỉ trong sổ địa chỉ");
        var isFirst = !await db.Addresses.AnyAsync(a => a.UserId == uid);
        var address = new Address { UserId = uid };
        Apply(address, req);
        address.IsDefault = req.IsDefault || isFirst;
        if (address.IsDefault) await ClearDefault(uid);
        db.Addresses.Add(address);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Addresses), ToDto(address));
    }

    [HttpPut("addresses/{id:int}")]
    public async Task<AddressDto> UpdateAddress(int id, AddressRequest req)
    {
        var uid = User.GetUserId();
        var address = await db.Addresses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == uid) ?? throw AppException.NotFound("Không tìm thấy địa chỉ");
        Apply(address, req);
        if (req.IsDefault && !address.IsDefault) { await ClearDefault(uid); address.IsDefault = true; }
        await db.SaveChangesAsync();
        return ToDto(address);
    }

    [HttpDelete("addresses/{id:int}")]
    public async Task<IActionResult> DeleteAddress(int id)
    {
        var uid = User.GetUserId();
        var address = await db.Addresses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == uid) ?? throw AppException.NotFound("Không tìm thấy địa chỉ");
        db.Addresses.Remove(address);
        await db.SaveChangesAsync();
        if (address.IsDefault)
        {
            var next = await db.Addresses.Where(a => a.UserId == uid).OrderByDescending(a => a.Id).FirstOrDefaultAsync();
            if (next is not null) { next.IsDefault = true; await db.SaveChangesAsync(); }
        }
        return NoContent();
    }

    private Task ClearDefault(int uid) =>
        db.Addresses.Where(a => a.UserId == uid && a.IsDefault).ExecuteUpdateAsync(s => s.SetProperty(a => a.IsDefault, false));

    private static void Apply(Address a, AddressRequest r)
    {
        a.RecipientName = r.RecipientName.Trim();
        a.Phone = r.Phone.Trim();
        a.Line1 = r.Line1.Trim();
        a.Ward = r.Ward?.Trim() ?? "";
        a.District = r.District.Trim();
        a.Province = r.Province.Trim();
    }

    private static AddressDto ToDto(Address a) => new(a.Id, a.RecipientName, a.Phone, a.Line1, a.Ward, a.District, a.Province, a.IsDefault);
}

[ApiController]
[Authorize]
[Route("api/wishlist")]
public class WishlistController(AppDbContext db, CatalogService catalog) : ControllerBase
{
    [HttpGet]
    public async Task<List<ProductCardDto>> Get()
    {
        var ids = await db.Wishlists.Where(w => w.UserId == User.GetUserId()).OrderByDescending(w => w.CreatedAt).Select(w => w.ProductId).ToListAsync();
        return await catalog.CardsAsync(ids);
    }

    [HttpGet("ids")]
    public async Task<List<int>> Ids() =>
        await db.Wishlists.Where(w => w.UserId == User.GetUserId()).Select(w => w.ProductId).ToListAsync();

    [HttpPost("{productId:int}")]
    public async Task<IActionResult> Add(int productId)
    {
        var uid = User.GetUserId();
        if (!await db.Products.AnyAsync(p => p.Id == productId && p.IsActive)) throw AppException.NotFound("Không tìm thấy sản phẩm");
        if (!await db.Wishlists.AnyAsync(w => w.UserId == uid && w.ProductId == productId))
        {
            if (await db.Wishlists.CountAsync(w => w.UserId == uid) >= 100) throw AppException.BadRequest("Danh sách yêu thích tối đa 100 sản phẩm");
            db.Wishlists.Add(new WishlistItem { UserId = uid, ProductId = productId });
            await db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpDelete("{productId:int}")]
    public async Task<IActionResult> Remove(int productId)
    {
        var uid = User.GetUserId();
        await db.Wishlists.Where(w => w.UserId == uid && w.ProductId == productId).ExecuteDeleteAsync();
        return NoContent();
    }
}

[ApiController]
[Authorize]
[Route("api/cart")]
public class CartController(CartService carts) : ControllerBase
{
    [HttpGet]
    public Task<CartDto> Get() => carts.GetAsync(User.GetUserId());

    [HttpPost("items")]
    public async Task<CartDto> Add(AddCartItemRequest req)
    {
        await carts.AddAsync(User.GetUserId(), req.VariantId, req.Quantity);
        return await carts.GetAsync(User.GetUserId());
    }

    [HttpPut("items/{variantId:int}")]
    public async Task<CartDto> Update(int variantId, UpdateCartItemRequest req)
    {
        await carts.UpdateAsync(User.GetUserId(), variantId, req.Quantity);
        return await carts.GetAsync(User.GetUserId());
    }

    [HttpDelete("items/{variantId:int}")]
    public async Task<CartDto> Remove(int variantId)
    {
        await carts.RemoveAsync(User.GetUserId(), variantId);
        return await carts.GetAsync(User.GetUserId());
    }

    [HttpDelete]
    public async Task<CartDto> Clear()
    {
        await carts.ClearAsync(User.GetUserId());
        return await carts.GetAsync(User.GetUserId());
    }
}
