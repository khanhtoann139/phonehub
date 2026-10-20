using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;
using PhoneHub.Api.Services;

namespace PhoneHub.Api.Data.Seed;

public class DbSeeder(AppDbContext db, IPasswordHasher<User> hasher, IOptions<SeedOptions> options, IWebHostEnvironment env,
    TimeProvider clock, ILogger<DbSeeder> logger)
{
    private record Cfg(int Storage, int Ram, decimal Price, decimal? Compare = null);
    private record P(string Name, string Brand, string Cat, string Style, bool Featured, string Short, (string Name, string Hex)[] Colors, Cfg[] Configs, Dictionary<string, string> Specs);

    public async Task SeedAsync(bool demoOrders = true)
    {
        var opt = options.Value;
        if (await db.Brands.AnyAsync()) { await EnsureAccountsAsync(opt); return; }

        logger.LogInformation("Seeding demo data…");
        var now = clock.GetUtcNow().UtcDateTime;

        var brands = new[]
        {
            ("Apple", "Thiết kế tinh tế, hệ sinh thái iOS liền mạch."), ("Samsung", "Dẫn đầu Android với màn hình Dynamic AMOLED."),
            ("Xiaomi", "Cấu hình mạnh, giá cạnh tranh."), ("OPPO", "Camera chân dung & sạc siêu nhanh."),
            ("vivo", "Nhiếp ảnh ZEISS chuyên nghiệp."), ("Google", "Trải nghiệm Android thuần & AI Gemini."),
            ("realme", "Hiệu năng trẻ trung, giá tốt."), ("ASUS", "ROG Phone cho game thủ."),
        }.Select((b, i) => new Brand { Name = b.Item1, Slug = Slug.From(b.Item1), Description = b.Item2, SortOrder = i }).ToList();
        db.Brands.AddRange(brands);

        var categories = new[]
        {
            ("Flagship", "Điện thoại cao cấp nhất của từng hãng"), ("Tầm trung", "Cân bằng hoàn hảo giữa giá và hiệu năng"),
            ("Giá rẻ", "Dưới 8 triệu, đủ dùng mỗi ngày"), ("Điện thoại gập", "Màn hình gập độc đáo"), ("Gaming", "Tản nhiệt tốt, tần số quét cao"),
        }.Select((c, i) => new Category { Name = c.Item1, Slug = Slug.From(c.Item1), Description = c.Item2, SortOrder = i }).ToList();
        db.Categories.AddRange(categories);
        await db.SaveChangesAsync();

        var imageDir = Path.Combine(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"), "images", "products");
        Directory.CreateDirectory(imageDir);

        var products = new List<Product>();
        var day = 0;
        foreach (var p in Catalog())
        {
            var brand = brands.First(b => b.Name == p.Brand);
            var product = new Product
            {
                Name = p.Name, Slug = Slug.From(p.Name), BrandId = brand.Id, CategoryId = categories.First(c => c.Name == p.Cat).Id,
                ShortDescription = p.Short, Description = Describe(p), SpecsJson = JsonSerializer.Serialize(p.Specs),
                IsFeatured = p.Featured, CreatedAt = now.AddDays(-(60 - day * 3)), UpdatedAt = now,
            };
            day++;
            var skuBase = string.Concat(product.Slug.Split('-').Select(s => s.Length > 3 ? s[..3] : s)).ToUpperInvariant();
            foreach (var (color, hex) in p.Colors)
            {
                foreach (var cfg in p.Configs)
                {
                    product.Variants.Add(new ProductVariant
                    {
                        Sku = $"{skuBase}-{ColorCode(color)}-{cfg.Storage}",
                        Color = color, ColorHex = hex, StorageGb = cfg.Storage, RamGb = cfg.Ram, Price = cfg.Price, CompareAtPrice = cfg.Compare,
                        Inventory = new Inventory { Quantity = RandomNumberGenerator.GetInt32(0, 40) < 3 ? RandomNumberGenerator.GetInt32(0, 4) : RandomNumberGenerator.GetInt32(8, 60), LowStockThreshold = 5, UpdatedAt = now },
                    });
                }
                for (var angle = 0; angle < 2; angle++)
                {
                    var file = $"{product.Slug}-{Slug.From(color)}-{angle}.svg";
                    await WriteImageAsync(Path.Combine(imageDir, file), PhoneImageGenerator.Svg(p.Name, p.Brand, hex, p.Style, angle == 0 ? 1 : 0));
                    product.Images.Add(new ProductImage
                    {
                        Url = $"/images/products/{file}", Alt = $"{p.Name} màu {color}{(angle == 0 ? " mặt lưng" : " mặt trước")}",
                        Color = color, SortOrder = product.Images.Count,
                    });
                }
            }
            products.Add(product);
        }
        db.Products.AddRange(products);

        db.Coupons.AddRange(
            new Coupon { Code = "WELCOME10", Description = "Giảm 10% cho đơn đầu tiên, tối đa 500.000₫", Type = CouponType.Percent, Value = 10, MaxDiscount = 500_000, MinOrderAmount = 3_000_000, StartsAt = now.AddDays(-30), EndsAt = now.AddDays(90), PerUserLimit = 1 },
            new Coupon { Code = "PHONEHUB500", Description = "Giảm 500.000₫ cho đơn từ 15 triệu", Type = CouponType.Fixed, Value = 500_000, MinOrderAmount = 15_000_000, StartsAt = now.AddDays(-10), EndsAt = now.AddDays(45), UsageLimit = 200 },
            new Coupon { Code = "FLAGSHIP1M", Description = "Giảm 1.000.000₫ cho đơn flagship từ 25 triệu", Type = CouponType.Fixed, Value = 1_000_000, MinOrderAmount = 25_000_000, StartsAt = now.AddDays(-5), EndsAt = now.AddDays(30), UsageLimit = 100, PerUserLimit = 1 },
            new Coupon { Code = "SINHVIEN5", Description = "Ưu đãi HSSV giảm 5%, tối đa 300.000₫", Type = CouponType.Percent, Value = 5, MaxDiscount = 300_000, MinOrderAmount = 0, StartsAt = now.AddDays(-60), EndsAt = now.AddDays(120) },
            new Coupon { Code = "VIP2026", Description = "Mã riêng khách VIP (không hiển thị công khai)", Type = CouponType.Percent, Value = 8, MaxDiscount = 2_000_000, MinOrderAmount = 10_000_000, StartsAt = now.AddDays(-1), EndsAt = now.AddDays(60), IsPublic = false },
            new Coupon { Code = "SUMMER2026", Description = "Khuyến mãi hè (đã kết thúc)", Type = CouponType.Percent, Value = 15, MaxDiscount = 1_000_000, MinOrderAmount = 0, StartsAt = now.AddDays(-120), EndsAt = now.AddDays(-30) });
        await db.SaveChangesAsync();

        await EnsureAccountsAsync(opt);
        if (demoOrders) await SeedOrdersAndReviewsAsync(products, now);
        logger.LogInformation("Seed completed: {Products} products, {Variants} variants", products.Count, products.Sum(p => p.Variants.Count));
    }

    private async Task EnsureAccountsAsync(SeedOptions opt)
    {
        await EnsureUserAsync(opt.AdminEmail, "Quản trị viên PhoneHub", Roles.Admin, opt.AdminPassword, "Seed:AdminPassword");
        await EnsureUserAsync(opt.CustomerEmail, "Nguyễn Minh Anh", Roles.Customer, opt.CustomerPassword, "Seed:CustomerPassword", "0901234567");
    }

    private async Task EnsureUserAsync(string email, string name, string role, string password, string configKey, string? phone = null)
    {
        email = AuthService.NormalizeEmail(email);
        if (await db.Users.AnyAsync(u => u.Email == email)) return;
        if (string.IsNullOrWhiteSpace(password))
        {
            if (!env.IsDevelopment())
                throw new InvalidOperationException($"{configKey} chưa được cấu hình — không thể tạo tài khoản {email}");
            // Chỉ ở Development: sinh mật khẩu ngẫu nhiên, in ra console MỘT lần (không ghi vào log file).
            password = "Ph" + Convert.ToBase64String(RandomNumberGenerator.GetBytes(9)).Replace('/', 'x').Replace('+', 'y') + "9a";
            Console.WriteLine($"[seed] Đã tạo tài khoản {email} với mật khẩu ngẫu nhiên: {password}  (đặt {configKey} trong .env để cố định)");
        }
        var user = new User { Email = email, FullName = name, Role = role, Phone = phone, CreatedAt = clock.GetUtcNow().UtcDateTime.AddDays(-90) };
        user.PasswordHash = hasher.HashPassword(user, password);
        db.Users.Add(user);
        await db.SaveChangesAsync();
    }

    /// <summary>Khách & đơn hàng mẫu trong 60 ngày gần nhất để dashboard có số liệu thật trong DB.</summary>
    private async Task SeedOrdersAndReviewsAsync(List<Product> products, DateTime now)
    {
        var names = new[] { "Trần Quốc Bảo", "Lê Thu Hà", "Phạm Đức Huy", "Võ Ngọc Lan", "Đặng Gia Hưng", "Bùi Khánh Linh", "Hoàng Tuấn Kiệt", "Ngô Mỹ Duyên", "Đỗ Thành Nam", "Huỳnh Bảo Ngọc" };
        var provinces = new[] { ("Quận 1", "TP. Hồ Chí Minh"), ("Quận Cầu Giấy", "Hà Nội"), ("Quận Hải Châu", "Đà Nẵng"), ("Quận Ninh Kiều", "Cần Thơ"), ("TP. Thủ Đức", "TP. Hồ Chí Minh") };
        var customers = names.Select((n, i) =>
        {
            var u = new User { Email = $"demo.customer{i + 1}@phonehub.local", FullName = n, Phone = $"09{RandomNumberGenerator.GetInt32(10000000, 99999999)}", Role = Roles.Customer, CreatedAt = now.AddDays(-RandomNumberGenerator.GetInt32(1, 75)) };
            // Tài khoản demo phụ: mật khẩu ngẫu nhiên không công bố → không đăng nhập được, chỉ phục vụ số liệu.
            u.PasswordHash = hasher.HashPassword(u, Convert.ToBase64String(RandomNumberGenerator.GetBytes(24)));
            return u;
        }).ToList();
        var mainCustomer = await db.Users.FirstAsync(u => u.Email == AuthService.NormalizeEmail(options.Value.CustomerEmail));
        db.Users.AddRange(customers);
        await db.SaveChangesAsync();
        customers.Add(mainCustomer);

        var statuses = new[] { OrderStatus.Delivered, OrderStatus.Delivered, OrderStatus.Delivered, OrderStatus.Delivered, OrderStatus.Shipping, OrderStatus.Confirmed, OrderStatus.Pending, OrderStatus.Cancelled };
        var reviewTexts = new[]
        {
            (5, "Rất hài lòng", "Máy đẹp, chạy mượt, pin dùng cả ngày thoải mái. Giao hàng nhanh, đóng gói cẩn thận."),
            (5, "Đáng tiền", "Camera chụp đêm rất ấn tượng, màn hình sáng rõ ngoài trời. Nhân viên tư vấn nhiệt tình."),
            (4, "Tốt", "Hiệu năng ổn định, chơi game không nóng nhiều. Chỉ tiếc sạc hơi lâu so với mong đợi."),
            (4, "Hài lòng", "Thiết kế sang, cầm chắc tay. Giao hàng đúng hẹn, có hỗ trợ chuyển dữ liệu."),
            (3, "Tạm ổn", "Máy dùng ổn nhưng loa ngoài hơi nhỏ, mong cửa hàng có thêm quà tặng."),
        };

        var orderNo = 0;
        foreach (var dayOffset in Enumerable.Range(0, 60))
        {
            var perDay = RandomNumberGenerator.GetInt32(0, 3);
            for (var k = 0; k < perDay; k++)
            {
                var user = customers[RandomNumberGenerator.GetInt32(customers.Count)];
                var product = products[RandomNumberGenerator.GetInt32(products.Count)];
                var variant = product.Variants[RandomNumberGenerator.GetInt32(product.Variants.Count)];
                var qty = RandomNumberGenerator.GetInt32(1, 10) == 1 ? 2 : 1;
                var created = now.AddDays(-dayOffset).AddHours(-RandomNumberGenerator.GetInt32(0, 12));
                var status = dayOffset < 3 ? (k % 2 == 0 ? OrderStatus.Pending : OrderStatus.Confirmed) : statuses[RandomNumberGenerator.GetInt32(statuses.Length)];
                var subtotal = variant.Price * qty;
                var shipping = subtotal >= 2_000_000 ? 0 : 30_000;
                var (district, province) = provinces[RandomNumberGenerator.GetInt32(provinces.Length)];
                var method = RandomNumberGenerator.GetInt32(3) == 0 ? "sandbox" : "cod";
                var paid = status == OrderStatus.Delivered || method == "sandbox" && status != OrderStatus.Cancelled;
                orderNo++;
                var order = new Order
                {
                    Code = $"PH{created:yyMMdd}D{orderNo:D4}", UserId = user.Id, Status = status, PaymentMethod = method,
                    PaymentStatus = paid ? PaymentStatus.Paid : status == OrderStatus.Cancelled ? PaymentStatus.Failed : PaymentStatus.Unpaid,
                    Subtotal = subtotal, ShippingFee = shipping, Total = subtotal + shipping,
                    ShipName = user.FullName, ShipPhone = user.Phone ?? "0900000000",
                    ShipAddress = $"{RandomNumberGenerator.GetInt32(1, 300)} Nguyễn Văn Linh, {district}, {province}",
                    CancelReason = status == OrderStatus.Cancelled ? "Khách đổi ý" : null, CreatedAt = created, UpdatedAt = created.AddHours(6),
                    Items =
                    [
                        new OrderItem
                        {
                            VariantId = variant.Id, ProductId = product.Id, ProductName = product.Name, ProductSlug = product.Slug,
                            VariantName = variant.DisplayName, Sku = variant.Sku, ImageUrl = product.Images.FirstOrDefault(i => i.Color == variant.Color)?.Url,
                            UnitPrice = variant.Price, Quantity = qty, LineTotal = subtotal,
                        },
                    ],
                };
                order.Payments.Add(new Payment
                {
                    Provider = method, Amount = order.Total, Status = paid ? PaymentStatus.Paid : status == OrderStatus.Cancelled ? PaymentStatus.Failed : PaymentStatus.Pending,
                    TxnRef = $"{order.Code}-1", CreatedAt = created, PaidAt = paid ? created.AddMinutes(5) : null,
                });
                db.Orders.Add(order);
                if (status != OrderStatus.Cancelled) product.SoldCount += qty;

                if (status == OrderStatus.Delivered && RandomNumberGenerator.GetInt32(3) > 0
                    && !db.Reviews.Local.Any(r => r.UserId == user.Id && r.ProductId == product.Id))
                {
                    var (rating, title, content) = reviewTexts[RandomNumberGenerator.GetInt32(reviewTexts.Length)];
                    db.Reviews.Add(new Review { ProductId = product.Id, UserId = user.Id, Rating = rating, Title = title, Content = content, IsVerifiedPurchase = true, CreatedAt = created.AddDays(4) });
                }
            }
        }
        await db.SaveChangesAsync();

        foreach (var p in products)
        {
            var rs = db.Reviews.Local.Where(r => r.ProductId == p.Id).ToList();
            p.RatingCount = rs.Count;
            p.RatingAvg = rs.Count == 0 ? 0 : Math.Round((decimal)rs.Average(r => r.Rating), 2);
        }
        await db.SaveChangesAsync();
    }

    /// <summary>Ảnh sinh ra là tất định → đã có thì giữ nguyên; tiến trình khác đang ghi cùng file thì bỏ qua.</summary>
    private static async Task WriteImageAsync(string path, string svg)
    {
        if (File.Exists(path)) return;
        try
        {
            await using var fs = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await using var w = new StreamWriter(fs);
            await w.WriteAsync(svg);
        }
        catch (IOException) { /* đã được tạo bởi tiến trình khác */ }
    }

    private static string ColorCode(string color)
    {
        var code = Slug.From(color).Replace("-", "").ToUpperInvariant();
        return code.Length > 10 ? code[..10] : code;
    }

    private static string Describe(P p) =>
        $"{p.Name} là lựa chọn {p.Cat.ToLowerInvariant()} nổi bật của {p.Brand}. {p.Short}\n\n" +
        $"Màn hình {p.Specs.GetValueOrDefault("Màn hình")}, vận hành bởi {p.Specs.GetValueOrDefault("Chip")} cho trải nghiệm mượt mà từ công việc đến giải trí. " +
        $"Hệ thống camera {p.Specs.GetValueOrDefault("Camera sau")} giúp bạn lưu giữ mọi khoảnh khắc. " +
        $"Viên pin {p.Specs.GetValueOrDefault("Pin")} cùng sạc {p.Specs.GetValueOrDefault("Sạc")} đồng hành cả ngày dài.\n\n" +
        "Sản phẩm chính hãng, bảo hành 12 tháng, 1 đổi 1 trong 30 ngày nếu có lỗi từ nhà sản xuất.";

    private static Dictionary<string, string> Specs(string screen, string chip, string ram, string rear, string front, string battery, string charge, string os, string weight, string ip) => new()
    {
        ["Màn hình"] = screen, ["Chip"] = chip, ["RAM"] = ram, ["Camera sau"] = rear, ["Camera trước"] = front,
        ["Pin"] = battery, ["Sạc"] = charge, ["Hệ điều hành"] = os, ["Trọng lượng"] = weight, ["Kháng nước"] = ip,
    };

    private static IEnumerable<P> Catalog() =>
    [
        new("iPhone 17 Pro Max", "Apple", "Flagship", "triple-square", true, "Khung nhôm nguyên khối, camera tele 8x và pin lâu nhất từ trước đến nay trên iPhone.",
            [("Cam Vũ Trụ", "#E8742A"), ("Xanh Đậm", "#2C3E5C"), ("Bạc", "#D9DADC")],
            [new(256, 12, 37_990_000), new(512, 12, 43_990_000), new(1024, 12, 49_990_000), new(2048, 12, 59_990_000)],
            Specs("6.9\" Super Retina XDR OLED, 120Hz ProMotion", "Apple A19 Pro", "12GB", "48MP chính + 48MP góc siêu rộng + 48MP tele 4x", "18MP Center Stage", "4.832 mAh", "40W có dây, MagSafe 25W", "iOS 26", "231 g", "IP68")),
        new("iPhone 17 Pro", "Apple", "Flagship", "triple-square", true, "Sức mạnh A19 Pro trong thân máy 6.3 inch gọn gàng.",
            [("Cam Vũ Trụ", "#E8742A"), ("Xanh Đậm", "#2C3E5C"), ("Bạc", "#D9DADC")],
            [new(256, 12, 34_990_000), new(512, 12, 40_990_000), new(1024, 12, 46_990_000)],
            Specs("6.3\" Super Retina XDR OLED, 120Hz ProMotion", "Apple A19 Pro", "12GB", "48MP chính + 48MP góc siêu rộng + 48MP tele 4x", "18MP Center Stage", "4.252 mAh", "40W có dây, MagSafe 25W", "iOS 26", "204 g", "IP68")),
        new("iPhone 17", "Apple", "Flagship", "vertical", true, "Màn hình 120Hz lần đầu xuất hiện trên iPhone tiêu chuẩn.",
            [("Đen", "#2B2B2E"), ("Trắng", "#F2F2F2"), ("Xanh Khói", "#9DB4C0"), ("Tím Oải Hương", "#C8B6E2")],
            [new(256, 8, 24_990_000), new(512, 8, 30_990_000)],
            Specs("6.3\" Super Retina XDR OLED, 120Hz", "Apple A19", "8GB", "48MP Fusion + 48MP góc siêu rộng", "18MP Center Stage", "3.692 mAh", "40W có dây", "iOS 26", "177 g", "IP68")),
        new("iPhone 16e", "Apple", "Tầm trung", "vertical", false, "iPhone dễ tiếp cận với chip A18 và Apple Intelligence.",
            [("Đen", "#2B2B2E"), ("Trắng", "#F2F2F2")],
            [new(128, 8, 15_990_000, 16_990_000), new(256, 8, 18_990_000, 19_990_000)],
            Specs("6.1\" Super Retina XDR OLED, 60Hz", "Apple A18", "8GB", "48MP Fusion", "12MP", "3.961 mAh", "20W có dây", "iOS 26", "167 g", "IP68")),
        new("Samsung Galaxy S25 Ultra", "Samsung", "Flagship", "vertical", true, "Bút S Pen, camera 200MP và Galaxy AI thông minh.",
            [("Titan Xám", "#6E6E73"), ("Titan Đen", "#2A2A2D"), ("Titan Xanh", "#7A8FA8")],
            [new(256, 12, 30_990_000, 33_990_000), new(512, 12, 34_990_000, 37_990_000), new(1024, 12, 42_990_000, 44_990_000)],
            Specs("6.9\" Dynamic AMOLED 2X, QHD+ 120Hz", "Snapdragon 8 Elite for Galaxy", "12GB", "200MP + 50MP góc siêu rộng + 50MP tele 5x + 10MP tele 3x", "12MP", "5.000 mAh", "45W có dây, 15W không dây", "Android 15, One UI 7", "218 g", "IP68")),
        new("Samsung Galaxy S25", "Samsung", "Flagship", "vertical", false, "Flagship nhỏ gọn, Galaxy AI đầy đủ.",
            [("Xanh Băng", "#BFD6E8"), ("Xanh Navy", "#273449"), ("Bạc Bóng Mờ", "#D5D6DA")],
            [new(256, 12, 20_990_000, 22_990_000), new(512, 12, 24_490_000, 26_490_000)],
            Specs("6.2\" Dynamic AMOLED 2X, FHD+ 120Hz", "Snapdragon 8 Elite for Galaxy", "12GB", "50MP + 12MP góc siêu rộng + 10MP tele 3x", "12MP", "4.000 mAh", "25W có dây", "Android 15, One UI 7", "162 g", "IP68")),
        new("Samsung Galaxy Z Fold7", "Samsung", "Điện thoại gập", "fold", true, "Gập mỏng nhẹ nhất từ trước đến nay, màn hình trong 8 inch.",
            [("Xanh Than", "#1F2A44"), ("Bạc Ánh Kim", "#C9CCD1")],
            [new(256, 12, 46_990_000), new(512, 12, 50_990_000), new(1024, 16, 58_990_000)],
            Specs("Trong 8.0\" / Ngoài 6.5\" Dynamic AMOLED 2X 120Hz", "Snapdragon 8 Elite for Galaxy", "12GB", "200MP + 12MP góc siêu rộng + 10MP tele 3x", "10MP + 10MP", "4.400 mAh", "25W có dây", "Android 16, One UI 8", "215 g", "IP48")),
        new("Samsung Galaxy Z Flip7", "Samsung", "Điện thoại gập", "fold", false, "Màn hình ngoài FlexWindow tràn viền 4.1 inch.",
            [("Đỏ San Hô", "#E05A5A"), ("Xanh Than", "#1F2A44")],
            [new(256, 12, 28_990_000, 29_990_000), new(512, 12, 32_990_000, 33_990_000)],
            Specs("Trong 6.9\" / Ngoài 4.1\" AMOLED 120Hz", "Exynos 2500", "12GB", "50MP + 12MP góc siêu rộng", "10MP", "4.300 mAh", "25W có dây", "Android 16, One UI 8", "188 g", "IP48")),
        new("Samsung Galaxy A56 5G", "Samsung", "Tầm trung", "vertical", false, "Thiết kế kính cao cấp, cập nhật 6 năm Android.",
            [("Xám Đen", "#3A3B3F"), ("Hồng", "#E9C6CF"), ("Xanh Olive", "#9AA48A")],
            [new(128, 8, 9_990_000, 10_990_000), new(256, 12, 11_490_000, 12_490_000)],
            Specs("6.7\" Super AMOLED, FHD+ 120Hz", "Exynos 1580", "8GB / 12GB", "50MP + 12MP góc siêu rộng + 5MP macro", "12MP", "5.000 mAh", "45W có dây", "Android 15, One UI 7", "198 g", "IP67")),
        new("Xiaomi 15T Pro", "Xiaomi", "Flagship", "bar", true, "Camera Leica tele 5x, sạc 90W siêu tốc.",
            [("Xám Titan", "#8A8D91"), ("Đen", "#1E1E20"), ("Vàng Mocha", "#B79B7A")],
            [new(256, 12, 19_990_000), new(512, 12, 21_990_000), new(1024, 12, 25_490_000)],
            Specs("6.83\" AMOLED 1.5K, 144Hz", "MediaTek Dimensity 9400+", "12GB", "50MP Leica + 50MP tele 5x + 12MP góc siêu rộng", "32MP", "5.500 mAh", "90W có dây, 50W không dây", "Android 15, HyperOS 3", "210 g", "IP68")),
        new("Xiaomi Redmi Note 14 Pro+ 5G", "Xiaomi", "Tầm trung", "bar", false, "Camera 200MP, sạc 120W, bền bỉ chuẩn IP68.",
            [("Đen Huyền Bí", "#25262A"), ("Tím Oải Hương", "#B7A6D9"), ("Trắng Băng", "#ECEEF2")],
            [new(256, 8, 10_490_000, 11_990_000), new(512, 12, 12_490_000, 13_490_000)],
            Specs("6.67\" AMOLED 1.5K, 120Hz", "Snapdragon 7s Gen 3", "8GB / 12GB", "200MP + 8MP góc siêu rộng + 2MP macro", "20MP", "5.110 mAh", "120W HyperCharge", "Android 14, HyperOS", "205 g", "IP68")),
        new("POCO X7 Pro", "Xiaomi", "Gaming", "bar", false, "Dimensity 8400-Ultra cho hiệu năng chiến game giá tốt.",
            [("Đen", "#1E1E20"), ("Vàng", "#E8C547")],
            [new(256, 8, 8_490_000, 9_490_000), new(512, 12, 9_990_000, 10_990_000)],
            Specs("6.67\" AMOLED 1.5K, 120Hz", "MediaTek Dimensity 8400-Ultra", "8GB / 12GB", "50MP + 8MP góc siêu rộng", "20MP", "6.000 mAh", "90W có dây", "Android 15, HyperOS 2", "195 g", "IP68")),
        new("OPPO Find X8 Pro", "OPPO", "Flagship", "default", true, "Hai camera tele periscope, chụp chân dung Hasselblad.",
            [("Trắng Ngọc Trai", "#F4F1EC"), ("Đen Không Gian", "#202124")],
            [new(512, 16, 29_990_000, 31_990_000)],
            Specs("6.78\" AMOLED 2K, 120Hz", "MediaTek Dimensity 9400", "16GB", "50MP + 50MP góc siêu rộng + 50MP tele 3x + 50MP tele 6x", "32MP", "5.910 mAh", "80W có dây, 50W không dây", "Android 15, ColorOS 15", "215 g", "IP69")),
        new("OPPO Reno14 5G", "OPPO", "Tầm trung", "vertical", false, "Thiết kế mỏng nhẹ, chụp chân dung AI ấn tượng.",
            [("Xanh Mint", "#9ED8C9"), ("Trắng Ngọc Trai", "#F4F1EC")],
            [new(256, 12, 15_990_000), new(512, 12, 17_990_000)],
            Specs("6.59\" AMOLED 1.5K, 120Hz", "MediaTek Dimensity 8350", "12GB", "50MP + 50MP tele 3.5x + 8MP góc siêu rộng", "50MP", "6.000 mAh", "80W SUPERVOOC", "Android 15, ColorOS 15", "187 g", "IP69")),
        new("OPPO A5 Pro", "OPPO", "Giá rẻ", "vertical", false, "Bền bỉ chuẩn quân đội, pin 5.800 mAh.",
            [("Nâu Đá", "#8B6F5A"), ("Xanh Đại Dương", "#3E6A8A")],
            [new(128, 8, 6_490_000, 6_990_000), new(256, 8, 7_290_000, 7_790_000)],
            Specs("6.67\" LCD HD+, 120Hz", "MediaTek Dimensity 6300", "8GB", "50MP + 2MP", "8MP", "5.800 mAh", "45W SUPERVOOC", "Android 15, ColorOS 15", "194 g", "IP69")),
        new("vivo X200 Pro", "vivo", "Flagship", "default", true, "Ống kính ZEISS APO tele 200MP, chụp xa đỉnh cao.",
            [("Titan", "#A79F94"), ("Đen Huyền", "#1C1C1E")],
            [new(512, 16, 29_990_000)],
            Specs("6.78\" AMOLED 1.5K, 120Hz", "MediaTek Dimensity 9400", "16GB", "50MP + 50MP góc siêu rộng + 200MP tele 3.7x ZEISS", "32MP", "6.000 mAh", "90W có dây, 30W không dây", "Android 15, Funtouch OS 15", "223 g", "IP69")),
        new("vivo V50", "vivo", "Tầm trung", "vertical", false, "Vòng sáng Aura Light, chụp chân dung ZEISS.",
            [("Hồng Phấn", "#E8BFC8"), ("Xám Sao Băng", "#7B7F86")],
            [new(256, 12, 13_990_000, 14_990_000), new(512, 12, 15_990_000, 16_990_000)],
            Specs("6.77\" AMOLED cong 1.5K, 120Hz", "Snapdragon 7 Gen 3", "12GB", "50MP ZEISS + 50MP góc siêu rộng", "50MP", "6.000 mAh", "90W FlashCharge", "Android 15, Funtouch OS 15", "199 g", "IP69")),
        new("Google Pixel 10 Pro", "Google", "Flagship", "bar", true, "Camera AI hàng đầu và 7 năm cập nhật Android.",
            [("Xám Sương", "#C7CBD1"), ("Đen Obsidian", "#202124"), ("Xanh Moonstone", "#5E6E80")],
            [new(256, 16, 27_990_000), new(512, 16, 31_990_000)],
            Specs("6.3\" LTPO OLED Super Actua, 120Hz", "Google Tensor G5", "16GB", "50MP + 48MP góc siêu rộng + 48MP tele 5x", "42MP", "4.870 mAh", "30W có dây, Qi2", "Android 16", "207 g", "IP68")),
        new("realme 14 Pro+ 5G", "realme", "Tầm trung", "default", false, "Mặt lưng đổi màu theo nhiệt độ, tele periscope 3x.",
            [("Trắng Ngọc Trai", "#F1EFEA"), ("Xám Đá", "#6F7378")],
            [new(256, 8, 11_990_000, 12_990_000), new(512, 12, 13_490_000, 14_490_000)],
            Specs("6.83\" AMOLED cong 1.5K, 120Hz", "Snapdragon 7s Gen 3", "8GB / 12GB", "50MP + 50MP tele 3x + 8MP góc siêu rộng", "32MP", "6.000 mAh", "80W SUPERVOOC", "Android 15, realme UI 6", "196 g", "IP69")),
        new("realme C75", "realme", "Giá rẻ", "vertical", false, "Pin 6.000 mAh, chống va đập, giá dễ chịu.",
            [("Vàng Ánh Kim", "#D8B86A"), ("Đen Bão Tố", "#2A2C30")],
            [new(128, 8, 4_690_000, 4_990_000), new(256, 8, 5_290_000, 5_590_000)],
            Specs("6.72\" IPS LCD FHD+, 90Hz", "MediaTek Helio G92 Max", "8GB", "50MP AI", "8MP", "6.000 mAh", "45W có dây", "Android 14, realme UI 5", "196 g", "IP69")),
        new("ASUS ROG Phone 9 Pro", "ASUS", "Gaming", "bar", false, "Màn hình 185Hz, AniMe Vision, tản nhiệt GameCool 9.",
            [("Đen Phantom", "#141416")],
            [new(512, 16, 28_990_000), new(1024, 24, 33_990_000)],
            Specs("6.78\" AMOLED FHD+, 185Hz", "Snapdragon 8 Elite", "16GB / 24GB", "50MP + 13MP góc siêu rộng + 32MP tele 3x", "32MP", "5.800 mAh", "65W có dây, 15W không dây", "Android 15, ROG UI", "227 g", "IP68")),
    ];
}
