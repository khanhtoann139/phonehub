using System.Text;
using Microsoft.EntityFrameworkCore;
using PhoneHub.Api.Domain;

namespace PhoneHub.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<Inventory> Inventory => Set<Inventory>();
    public DbSet<Cart> Carts => Set<Cart>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<WishlistItem> Wishlists => Set<WishlistItem>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(190).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(255).IsRequired();
            e.Property(x => x.FullName).HasMaxLength(120).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(20);
            e.Property(x => x.Role).HasMaxLength(20).IsRequired();
        });

        b.Entity<RefreshToken>(e =>
        {
            e.ToTable("refresh_tokens");
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => x.FamilyId);
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            e.Property(x => x.FamilyId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ReplacedByHash).HasMaxLength(64);
            e.Property(x => x.CreatedByIp).HasMaxLength(64);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Address>(e =>
        {
            e.ToTable("addresses");
            e.Property(x => x.RecipientName).HasMaxLength(120).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(20).IsRequired();
            e.Property(x => x.Line1).HasMaxLength(255).IsRequired();
            e.Property(x => x.Ward).HasMaxLength(100);
            e.Property(x => x.District).HasMaxLength(100);
            e.Property(x => x.Province).HasMaxLength(100);
            e.HasOne(x => x.User).WithMany(u => u.Addresses).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Brand>(e =>
        {
            e.ToTable("brands");
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(120).IsRequired();
            e.Property(x => x.LogoUrl).HasMaxLength(500);
            e.Property(x => x.Description).HasMaxLength(1000);
        });

        b.Entity<Category>(e =>
        {
            e.ToTable("categories");
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(120).IsRequired();
            e.Property(x => x.Description).HasMaxLength(1000);
            e.HasOne(x => x.Parent).WithMany().HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Product>(e =>
        {
            e.ToTable("products");
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => new { x.IsActive, x.CategoryId });
            e.HasIndex(x => x.Name);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(220).IsRequired();
            e.Property(x => x.ShortDescription).HasMaxLength(500);
            e.Property(x => x.Description).HasColumnType("text");
            e.Property(x => x.SpecsJson).HasColumnType("text");
            e.Property(x => x.RatingAvg).HasPrecision(3, 2);
            e.HasOne(x => x.Brand).WithMany(x => x.Products).HasForeignKey(x => x.BrandId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Category).WithMany(x => x.Products).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<ProductVariant>(e =>
        {
            e.ToTable("product_variants");
            e.HasIndex(x => x.Sku).IsUnique();
            e.HasIndex(x => new { x.ProductId, x.Color, x.StorageGb }).IsUnique();
            e.HasIndex(x => x.Price);
            e.Property(x => x.Sku).HasMaxLength(64).IsRequired();
            e.Property(x => x.Color).HasMaxLength(60).IsRequired();
            e.Property(x => x.ColorHex).HasMaxLength(9).IsRequired();
            e.Property(x => x.Price).HasPrecision(18, 2);
            e.Property(x => x.CompareAtPrice).HasPrecision(18, 2);
            e.Ignore(x => x.DisplayName);
            e.Ignore(x => x.StorageLabel);
            e.HasOne(x => x.Product).WithMany(x => x.Variants).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ProductImage>(e =>
        {
            e.ToTable("product_images");
            e.Property(x => x.Url).HasMaxLength(500).IsRequired();
            e.Property(x => x.Alt).HasMaxLength(200);
            e.Property(x => x.Color).HasMaxLength(60);
            e.HasOne(x => x.Product).WithMany(x => x.Images).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Inventory>(e =>
        {
            e.ToTable("inventory");
            e.HasKey(x => x.VariantId);
            e.HasOne(x => x.Variant).WithOne(v => v.Inventory).HasForeignKey<Inventory>(x => x.VariantId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Cart>(e =>
        {
            e.ToTable("carts");
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<CartItem>(e =>
        {
            e.ToTable("cart_items");
            e.HasIndex(x => new { x.CartId, x.VariantId }).IsUnique();
            e.HasOne(x => x.Cart).WithMany(x => x.Items).HasForeignKey(x => x.CartId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Variant).WithMany().HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<WishlistItem>(e =>
        {
            e.ToTable("wishlists");
            e.HasIndex(x => new { x.UserId, x.ProductId }).IsUnique();
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Coupon>(e =>
        {
            e.ToTable("coupons");
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Code).HasMaxLength(40).IsRequired();
            e.Property(x => x.Description).HasMaxLength(255);
            e.Property(x => x.Type).HasConversion<int>();
            e.Property(x => x.Value).HasPrecision(18, 2);
            e.Property(x => x.MaxDiscount).HasPrecision(18, 2);
            e.Property(x => x.MinOrderAmount).HasPrecision(18, 2);
        });

        b.Entity<Order>(e =>
        {
            e.ToTable("orders");
            e.HasIndex(x => x.Code).IsUnique();
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.HasIndex(x => new { x.Status, x.CreatedAt });
            e.Property(x => x.Code).HasMaxLength(20).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.PaymentMethod).HasMaxLength(20).IsRequired();
            e.Property(x => x.PaymentStatus).HasMaxLength(20).IsRequired();
            e.Property(x => x.Subtotal).HasPrecision(18, 2);
            e.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            e.Property(x => x.ShippingFee).HasPrecision(18, 2);
            e.Property(x => x.Total).HasPrecision(18, 2);
            e.Property(x => x.CouponCode).HasMaxLength(40);
            e.Property(x => x.ShipName).HasMaxLength(120).IsRequired();
            e.Property(x => x.ShipPhone).HasMaxLength(20).IsRequired();
            e.Property(x => x.ShipAddress).HasMaxLength(500).IsRequired();
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.CancelReason).HasMaxLength(255);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Coupon).WithMany().HasForeignKey(x => x.CouponId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<OrderItem>(e =>
        {
            e.ToTable("order_items");
            e.Property(x => x.ProductName).HasMaxLength(200).IsRequired();
            e.Property(x => x.ProductSlug).HasMaxLength(220).IsRequired();
            e.Property(x => x.VariantName).HasMaxLength(120).IsRequired();
            e.Property(x => x.Sku).HasMaxLength(64).IsRequired();
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.Property(x => x.UnitPrice).HasPrecision(18, 2);
            e.Property(x => x.LineTotal).HasPrecision(18, 2);
            e.HasOne(x => x.Order).WithMany(x => x.Items).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Variant).WithMany().HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Payment>(e =>
        {
            e.ToTable("payments");
            e.HasIndex(x => x.TxnRef).IsUnique();
            e.Property(x => x.Provider).HasMaxLength(20).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.TxnRef).HasMaxLength(40).IsRequired();
            e.Property(x => x.ProviderTxnId).HasMaxLength(64);
            e.Property(x => x.ResponseCode).HasMaxLength(10);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.HasOne(x => x.Order).WithMany(x => x.Payments).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Review>(e =>
        {
            e.ToTable("reviews");
            e.HasIndex(x => new { x.UserId, x.ProductId }).IsUnique();
            e.HasIndex(x => new { x.ProductId, x.IsApproved });
            e.Property(x => x.Title).HasMaxLength(150);
            e.Property(x => x.Content).HasMaxLength(2000).IsRequired();
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ContactMessage>(e =>
        {
            e.ToTable("contact_messages");
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Email).HasMaxLength(190).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(20);
            e.Property(x => x.Subject).HasMaxLength(200).IsRequired();
            e.Property(x => x.Message).HasMaxLength(4000).IsRequired();
        });

        b.Entity<AuditLog>(e =>
        {
            e.ToTable("audit_logs");
            e.HasIndex(x => x.CreatedAt);
            e.Property(x => x.Action).HasMaxLength(60).IsRequired();
            e.Property(x => x.Entity).HasMaxLength(60).IsRequired();
            e.Property(x => x.EntityId).HasMaxLength(64);
            e.Property(x => x.Data).HasMaxLength(4000);
            e.Property(x => x.Ip).HasMaxLength(64);
        });

        ApplySnakeCaseColumns(b);

        // Mọi thời điểm lưu UTC; MySQL/SQLite không giữ DateTimeKind → gắn lại Utc khi đọc để JSON có hậu tố "Z".
        var utc = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(), v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        var utcNullable = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime?, DateTime?>(
            v => v == null ? v : v.Value.Kind == DateTimeKind.Utc ? v : v.Value.ToUniversalTime(),
            v => v == null ? v : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc));
        foreach (var p in b.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
        {
            if (p.ClrType == typeof(DateTime)) p.SetValueConverter(utc);
            else if (p.ClrType == typeof(DateTime?)) p.SetValueConverter(utcNullable);
        }

        // SQLite (dùng cho test/chạy thử) không so sánh/sắp xếp được decimal ở phía DB → lưu dạng REAL.
        if (Database.IsSqlite())
        {
            foreach (var p in b.Model.GetEntityTypes().SelectMany(t => t.GetProperties())
                         .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
                p.SetProviderClrType(typeof(double));
        }
    }

    private static void ApplySnakeCaseColumns(ModelBuilder b)
    {
        foreach (var entity in b.Model.GetEntityTypes())
            foreach (var prop in entity.GetProperties())
                prop.SetColumnName(ToSnake(prop.Name));
    }

    internal static string ToSnake(string name)
    {
        var sb = new StringBuilder(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            var c = name[i];
            if (char.IsUpper(c))
            {
                if (i > 0 && (char.IsLower(name[i - 1]) || (i + 1 < name.Length && char.IsLower(name[i + 1]) && char.IsUpper(name[i - 1]))))
                    sb.Append('_');
                sb.Append(char.ToLowerInvariant(c));
            }
            else sb.Append(c);
        }
        return sb.ToString();
    }
}
