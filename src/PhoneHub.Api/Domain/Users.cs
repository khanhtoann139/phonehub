namespace PhoneHub.Api.Domain;

public static class Roles
{
    public const string Customer = "customer";
    public const string Admin = "admin";
}

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string FullName { get; set; } = "";
    public string? Phone { get; set; }
    public string Role { get; set; } = Roles.Customer;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<Address> Addresses { get; set; } = [];
}

public class RefreshToken
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>SHA-256 (hex) của token — token gốc chỉ nằm trong cookie của client.</summary>
    public string TokenHash { get; set; } = "";
    /// <summary>Mọi token sinh ra từ cùng một lần đăng nhập chung family; tái sử dụng token cũ → thu hồi cả family.</summary>
    public string FamilyId { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByHash { get; set; }
    public string? CreatedByIp { get; set; }

    public bool IsActive(DateTime now) => RevokedAt is null && ExpiresAt > now;
}

public class Address
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string RecipientName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Line1 { get; set; } = "";
    public string Ward { get; set; } = "";
    public string District { get; set; } = "";
    public string Province { get; set; } = "";
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
