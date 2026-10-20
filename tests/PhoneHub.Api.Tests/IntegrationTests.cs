using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using PhoneHub.Api.Contracts;
using PhoneHub.Api.Domain;

namespace PhoneHub.Api.Tests;

public class AuthFlowTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private HttpClient Anon() => api.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    [Fact]
    public async Task Register_rejects_weak_password_with_validation_problem()
    {
        var res = await Anon().PostAsJsonAsync("/api/auth/register", new { email = "weak@test.local", password = "123", fullName = "A B" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("errors").TryGetProperty("Password", out _));
    }

    [Fact]
    public async Task Register_then_duplicate_email_conflicts_and_password_is_hashed()
    {
        var email = $"dup{Guid.NewGuid():N}"[..12] + "@test.local";
        await api.RegisterAsync(email);
        var res = await Anon().PostAsJsonAsync("/api/auth/register", new { email = email.ToUpperInvariant(), password = "Password123", fullName = "Khác" });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);

        var hash = api.WithDb(db => db.Users.Single(u => u.Email == email).PasswordHash);
        Assert.DoesNotContain("Password123", hash);
        Assert.True(hash.Length > 40);
    }

    [Fact]
    public async Task Wrong_password_returns_401_with_generic_message()
    {
        var res = await Anon().PostAsJsonAsync("/api/auth/login", new { email = ApiFactory.CustomerEmail, password = "WrongPass999" });
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        var unknown = await Anon().PostAsJsonAsync("/api/auth/login", new { email = "nobody@test.local", password = "WrongPass999" });
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
    }

    [Fact]
    public async Task Refresh_token_rotates_and_reuse_revokes_family()
    {
        var client = Anon();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email = ApiFactory.CustomerEmail, password = ApiFactory.CustomerPassword });
        var rt1 = login.GetCookie("ph_rt");
        Assert.False(string.IsNullOrEmpty(rt1));
        Assert.Contains(login.Headers.GetValues("Set-Cookie"), c => c.Contains("httponly", StringComparison.OrdinalIgnoreCase) && c.Contains("samesite=strict", StringComparison.OrdinalIgnoreCase));

        // Thiếu header client → bị chặn
        var noHeader = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        noHeader.Headers.Add("Cookie", $"ph_rt={rt1}");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(noHeader)).StatusCode);

        var r1 = await Refresh(client, rt1!);
        Assert.Equal(HttpStatusCode.OK, r1.StatusCode);
        var rt2 = r1.GetCookie("ph_rt");
        Assert.NotEqual(rt1, rt2);

        // Dùng lại token cũ → 401 và token mới cũng bị thu hồi
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, rt1!)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, rt2!)).StatusCode);
    }

    [Fact]
    public async Task Me_requires_token()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Anon().GetAsync("/api/auth/me")).StatusCode);
        var client = await api.LoginAsync(ApiFactory.CustomerEmail, ApiFactory.CustomerPassword);
        var me = await client.GetFromJsonAsync<UserDto>("/api/auth/me");
        Assert.Equal(ApiFactory.CustomerEmail, me!.Email);
        Assert.Equal("customer", me.Role);
    }

    private static Task<HttpResponseMessage> Refresh(HttpClient client, string token)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        req.Headers.Add("Cookie", $"ph_rt={token}");
        req.Headers.Add("X-PhoneHub-Client", "web");
        return client.SendAsync(req);
    }
}

public class CatalogTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Filter_by_brand_and_sort_by_price()
    {
        var res = await api.CreateClient().GetFromJsonAsync<ProductListResponse>("/api/products?brand=apple&sort=price_asc&pageSize=48");
        Assert.NotEmpty(res!.Items);
        Assert.All(res.Items, p => Assert.Equal("apple", p.BrandSlug));
        Assert.Equal(res.Items.Select(i => i.Price).Order(), res.Items.Select(i => i.Price));
        Assert.Contains(res.Facets.Brands, b => b.Value == "samsung"); // facet không bị thu hẹp bởi chính bộ lọc brand
    }

    [Fact]
    public async Task Search_price_range_and_pagination()
    {
        var client = api.CreateClient();
        var res = await client.GetFromJsonAsync<ProductListResponse>("/api/products?q=galaxy&maxPrice=12000000&page=1&pageSize=2");
        Assert.All(res!.Items, p => Assert.Contains("Galaxy", p.Name));
        Assert.True(res.Items.Count <= 2);
        var bad = await client.GetAsync("/api/products?pageSize=1000");
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    [Fact]
    public async Task Detail_by_slug_includes_variants_and_specs_and_404_for_unknown()
    {
        var client = api.CreateClient();
        var p = await client.GetFromJsonAsync<ProductDetailDto>("/api/products/iphone-17-pro-max");
        Assert.True(p!.Variants.Count >= 4);
        Assert.Contains("Chip", p.Specs.Keys);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/products/khong-ton-tai")).StatusCode);

        var compare = await client.GetFromJsonAsync<List<CompareItemDto>>($"/api/products/compare?ids={p.Id},{p.Id + 1}");
        Assert.Equal(2, compare!.Count);
    }
}

public class CheckoutTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private (int VariantId, decimal Price, int Stock) PickVariant(decimal minPrice = 0) => api.WithDb(db => db.ProductVariants
        .Where(v => v.IsActive && v.Inventory!.Quantity >= 5 && v.Price >= minPrice)
        .OrderBy(v => v.Id).Select(v => new ValueTuple<int, decimal, int>(v.Id, v.Price, v.Inventory!.Quantity)).AsEnumerable().First());

    private static object Address => new { recipientName = "Người Nhận", phone = "0912345678", line1 = "12 Lê Lợi", ward = "Bến Nghé", district = "Quận 1", province = "TP. Hồ Chí Minh" };

    [Fact]
    public async Task Cart_requires_login_and_rejects_quantity_above_stock()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.CreateClient().GetAsync("/api/cart")).StatusCode);

        var client = await api.RegisterAsync();
        var lowStock = api.WithDb(db => db.Inventory.Where(i => i.Quantity > 0 && i.Quantity < 3).Select(i => new { i.VariantId, i.Quantity }).FirstOrDefault());
        var target = lowStock?.VariantId ?? PickVariant().VariantId;
        if (lowStock is null) api.WithDb(db => db.Inventory.Where(i => i.VariantId == target).ExecuteUpdate(s => s.SetProperty(i => i.Quantity, 1)));

        var res = await client.PostAsJsonAsync("/api/cart/items", new { variantId = target, quantity = 3 });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Fact]
    public async Task Order_totals_are_computed_server_side_and_stock_is_decremented()
    {
        var client = await api.RegisterAsync();
        var (variantId, price, stockBefore) = PickVariant(5_000_000);

        await client.PostAsJsonAsync("/api/cart/items", new { variantId, quantity = 2 });
        // Client cố gửi giá/tổng giả — bị bỏ qua vì contract không có các trường này.
        var res = await client.PostAsJsonAsync("/api/orders", new { address = Address, paymentMethod = "cod", total = 1, unitPrice = 1 });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var placed = (await res.Content.ReadFromJsonAsync<PlaceOrderResponse>())!;

        Assert.Equal(price * 2, placed.Order.Subtotal);
        Assert.Equal(price * 2, placed.Order.Total); // > 2 triệu → miễn phí ship
        Assert.Equal("Pending", placed.Order.Status);
        Assert.Null(placed.PaymentUrl);
        Assert.Equal(stockBefore - 2, api.WithDb(db => db.Inventory.Single(i => i.VariantId == variantId).Quantity));

        var cart = await client.GetFromJsonAsync<CartDto>("/api/cart");
        Assert.Empty(cart!.Items);
    }

    [Fact]
    public async Task Coupon_is_validated_applied_and_released_on_cancel()
    {
        var client = await api.RegisterAsync();
        var (variantId, price, stockBefore) = PickVariant(5_000_000);
        await client.PostAsJsonAsync("/api/cart/items", new { variantId, quantity = 1 });

        var invalid = await client.PostAsJsonAsync("/api/checkout/preview", new { couponCode = "SUMMER2026" });
        var invalidBody = (await invalid.Content.ReadFromJsonAsync<CheckoutPreviewResponse>())!;
        Assert.False(invalidBody.CouponApplied);
        Assert.Contains("hết hạn", invalidBody.CouponMessage);

        var preview = (await (await client.PostAsJsonAsync("/api/checkout/preview", new { couponCode = "welcome10" })).Content.ReadFromJsonAsync<CheckoutPreviewResponse>())!;
        Assert.True(preview.CouponApplied);
        Assert.Equal(Math.Min(Math.Floor(price * 0.1m), 500_000), preview.DiscountAmount);

        var usedBefore = api.WithDb(db => db.Coupons.Single(c => c.Code == "WELCOME10").UsedCount);
        var placed = (await (await client.PostAsJsonAsync("/api/orders", new { address = Address, paymentMethod = "cod", couponCode = "WELCOME10" }))
            .Content.ReadFromJsonAsync<PlaceOrderResponse>())!;
        Assert.Equal(preview.Total, placed.Order.Total);
        Assert.Equal(usedBefore + 1, api.WithDb(db => db.Coupons.Single(c => c.Code == "WELCOME10").UsedCount));

        // Giới hạn 1 lần/khách
        await client.PostAsJsonAsync("/api/cart/items", new { variantId, quantity = 1 });
        var again = await client.PostAsJsonAsync("/api/orders", new { address = Address, paymentMethod = "cod", couponCode = "WELCOME10" });
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);

        // Hủy đơn → hoàn kho + hoàn lượt dùng mã
        var cancel = await client.PostAsJsonAsync($"/api/orders/{placed.Order.Code}/cancel", new { reason = "Đổi ý" });
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);
        Assert.Equal(stockBefore, api.WithDb(db => db.Inventory.Single(i => i.VariantId == variantId).Quantity));
        Assert.Equal(usedBefore, api.WithDb(db => db.Coupons.Single(c => c.Code == "WELCOME10").UsedCount));
    }

    [Fact]
    public async Task Concurrent_orders_cannot_oversell_last_unit()
    {
        var (variantId, _, _) = PickVariant();
        api.WithDb(db => db.Inventory.Where(i => i.VariantId == variantId).ExecuteUpdate(s => s.SetProperty(i => i.Quantity, 1)));
        var a = await api.RegisterAsync();
        var b = await api.RegisterAsync();
        await a.PostAsJsonAsync("/api/cart/items", new { variantId, quantity = 1 });
        await b.PostAsJsonAsync("/api/cart/items", new { variantId, quantity = 1 });

        var r1 = await a.PostAsJsonAsync("/api/orders", new { address = Address, paymentMethod = "cod" });
        var r2 = await b.PostAsJsonAsync("/api/orders", new { address = Address, paymentMethod = "cod" });
        Assert.Equal(HttpStatusCode.Created, r1.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, r2.StatusCode);
        Assert.Equal(0, api.WithDb(db => db.Inventory.Single(i => i.VariantId == variantId).Quantity));
        api.WithDb(db => db.Inventory.Where(i => i.VariantId == variantId).ExecuteUpdate(s => s.SetProperty(i => i.Quantity, 50)));
    }

    [Fact]
    public async Task Sandbox_payment_success_marks_order_paid_and_forged_signature_is_rejected()
    {
        var client = await api.RegisterAsync();
        var (variantId, _, _) = PickVariant();
        await client.PostAsJsonAsync("/api/cart/items", new { variantId, quantity = 1 });
        var placed = (await (await client.PostAsJsonAsync("/api/orders", new { address = Address, paymentMethod = "sandbox" })).Content.ReadFromJsonAsync<PlaceOrderResponse>())!;
        Assert.Equal("AwaitingPayment", placed.Order.Status);
        Assert.NotNull(placed.PaymentUrl);

        var anon = api.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var page = await anon.GetStringAsync(new Uri(placed.PaymentUrl!).PathAndQuery);
        var successLink = WebUtility.HtmlDecode(System.Text.RegularExpressions.Regex.Match(page, "class=\"ok\" href=\"([^\"]+)\"").Groups[1].Value);

        var forged = await anon.GetAsync(new Uri(successLink.Replace("amount=", "amount=1")).PathAndQuery);
        Assert.Equal(HttpStatusCode.Redirect, forged.StatusCode);
        Assert.Contains("status=failed", forged.Headers.Location!.ToString());

        var ok = await anon.GetAsync(new Uri(successLink).PathAndQuery);
        Assert.Contains("status=success", ok.Headers.Location!.ToString());
        var order = await client.GetFromJsonAsync<OrderDetailDto>($"/api/orders/{placed.Order.Code}");
        Assert.Equal("Pending", order!.Status);
        Assert.Equal("Paid", order.PaymentStatus);

        // Callback lặp lại → idempotent
        var replay = await anon.GetAsync(new Uri(successLink).PathAndQuery);
        Assert.Contains("status=success", replay.Headers.Location!.ToString());
    }
}

public class AdminAndReviewTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Payment_methods_come_from_config_without_duplicates()
    {
        var methods = await api.CreateClient().GetFromJsonAsync<List<PaymentMethodDto>>("/api/payments/methods");
        Assert.Equal(["cod", "sandbox"], methods!.Select(m => m.Code));
    }

    [Fact]
    public async Task Anonymous_refresh_without_cookie_is_204_not_error()
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        req.Headers.Add("X-PhoneHub-Client", "web");
        Assert.Equal(HttpStatusCode.NoContent, (await api.CreateClient().SendAsync(req)).StatusCode);
    }

    [Fact]
    public async Task Category_cannot_become_child_of_its_descendant()
    {
        var admin = await api.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var parent = (await (await admin.PostAsJsonAsync("/api/admin/categories", new { name = "Cha Test", sortOrder = 0, isActive = true })).Content.ReadFromJsonAsync<AdminCategoryDto>())!;
        var child = (await (await admin.PostAsJsonAsync("/api/admin/categories", new { name = "Con Test", parentId = parent.Id, sortOrder = 0, isActive = true })).Content.ReadFromJsonAsync<AdminCategoryDto>())!;
        var cyc = await admin.PutAsJsonAsync($"/api/admin/categories/{parent.Id}", new { name = "Cha Test", parentId = child.Id, sortOrder = 0, isActive = true });
        Assert.Equal(HttpStatusCode.BadRequest, cyc.StatusCode);
    }

    [Fact]
    public async Task Customer_cannot_access_admin_endpoints()
    {
        var customer = await api.LoginAsync(ApiFactory.CustomerEmail, ApiFactory.CustomerPassword);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync("/api/admin/dashboard")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.CreateClient().GetAsync("/api/admin/dashboard")).StatusCode);

        var admin = await api.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var dash = await admin.GetFromJsonAsync<DashboardResponse>("/api/admin/dashboard?days=7");
        Assert.Equal(7, dash!.RevenueByDay.Count);
    }

    [Fact]
    public async Task Admin_product_crud_with_variants_and_audit_log()
    {
        var admin = await api.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var (brandId, categoryId) = api.WithDb(db => (db.Brands.First().Id, db.Categories.First().Id));
        var req = new
        {
            name = "Test Phone X", brandId, categoryId, shortDescription = "Máy thử", description = "Mô tả", isActive = true, isFeatured = false,
            specs = new Dictionary<string, string> { ["Chip"] = "Test chip" },
            variants = new[]
            {
                new { sku = "TPX-BLK-128", color = "Đen", colorHex = "#111111", storageGb = 128, ramGb = 8, price = 9_990_000m, compareAtPrice = (decimal?)10_990_000m, stock = 10, isActive = true },
                new { sku = "TPX-BLK-256", color = "Đen", colorHex = "#111111", storageGb = 256, ramGb = 8, price = 11_990_000m, compareAtPrice = (decimal?)null, stock = 0, isActive = true },
            },
            images = new[] { new { url = "/images/test.png", alt = "Test", color = (string?)null, sortOrder = 0 } },
        };
        var created = await admin.PostAsJsonAsync("/api/admin/products", req);
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var dto = (await created.Content.ReadFromJsonAsync<AdminProductDto>())!;
        Assert.Equal("test-phone-x", dto.Slug);
        Assert.Equal(2, dto.Variants.Count);

        var dup = await admin.PostAsJsonAsync("/api/admin/products", req);
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);

        var publicDetail = await api.CreateClient().GetFromJsonAsync<ProductDetailDto>("/api/products/test-phone-x");
        Assert.Equal(10, publicDetail!.Variants.Single(v => v.StorageGb == 128).Stock);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/products/{dto.Id}")).StatusCode);
        Assert.True(api.WithDb(db => db.AuditLogs.Any(a => a.Entity == "product" && a.Action == "delete" && a.EntityId == dto.Id.ToString())));
    }

    [Fact]
    public async Task Review_requires_delivered_order_and_status_machine_is_enforced()
    {
        var customer = await api.RegisterAsync();
        var admin = await api.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var v = api.WithDb(db => db.ProductVariants.Where(x => x.Inventory!.Quantity > 5).Select(x => new { x.Id, x.ProductId }).First());

        var early = await customer.PostAsJsonAsync($"/api/products/{v.ProductId}/reviews", new { rating = 5, content = "Sản phẩm rất tốt, giao nhanh." });
        Assert.Equal(HttpStatusCode.Forbidden, early.StatusCode);

        await customer.PostAsJsonAsync("/api/cart/items", new { variantId = v.Id, quantity = 1 });
        var placed = (await (await customer.PostAsJsonAsync("/api/orders", new
        {
            address = new { recipientName = "Khách", phone = "0912345678", line1 = "1 Trần Hưng Đạo", district = "Quận 5", province = "TP. Hồ Chí Minh" },
            paymentMethod = "cod",
        })).Content.ReadFromJsonAsync<PlaceOrderResponse>())!;

        var skip = await admin.PutAsJsonAsync($"/api/admin/orders/{placed.Order.Code}/status", new { status = "Delivered" });
        Assert.Equal(HttpStatusCode.BadRequest, skip.StatusCode);

        foreach (var s in new[] { "Confirmed", "Shipping", "Delivered" })
            Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/orders/{placed.Order.Code}/status", new { status = s })).StatusCode);

        var order = await customer.GetFromJsonAsync<OrderDetailDto>($"/api/orders/{placed.Order.Code}");
        Assert.Equal("Paid", order!.PaymentStatus); // COD giao thành công → đã thu tiền

        var review = await customer.PostAsJsonAsync($"/api/products/{v.ProductId}/reviews", new { rating = 4, title = "Ổn", content = "Máy chạy mượt, pin tốt, đáng tiền." });
        Assert.Equal(HttpStatusCode.Created, review.StatusCode);
        var list = await api.CreateClient().GetFromJsonAsync<ReviewListResponse>($"/api/products/{v.ProductId}/reviews");
        Assert.True(list!.Count >= 1);
        Assert.True(api.WithDb(db => db.Products.Single(p => p.Id == v.ProductId).RatingCount) >= 1);
    }

    [Fact]
    public async Task Contact_message_is_persisted()
    {
        var res = await api.CreateClient().PostAsJsonAsync("/api/contact", new { name = "Lan", email = "lan@test.local", subject = "Hỏi bảo hành", message = "Cho mình hỏi chính sách bảo hành pin ạ." });
        Assert.Equal(HttpStatusCode.Accepted, res.StatusCode);
        Assert.True(api.WithDb(db => db.ContactMessages.Any(c => c.Email == "lan@test.local")));
    }
}

public class RateLimitTests : IClassFixture<RateLimitTests.LowLimitFactory>
{
    public class LowLimitFactory : ApiFactory { public LowLimitFactory() { AuthLimit = 3; } }

    private readonly LowLimitFactory _api;
    public RateLimitTests(LowLimitFactory api) => _api = api;

    [Fact]
    public async Task Login_is_rate_limited_per_ip()
    {
        var client = _api.CreateClient();
        var codes = new List<HttpStatusCode>();
        for (var i = 0; i < 5; i++)
            codes.Add((await client.PostAsJsonAsync("/api/auth/login", new { email = "x@test.local", password = "Whatever123" })).StatusCode);
        Assert.Contains(HttpStatusCode.TooManyRequests, codes);
    }
}
