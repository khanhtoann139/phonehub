namespace PhoneHub.Api.Infrastructure;

public class JwtOptions
{
    public string Issuer { get; set; } = "phonehub";
    public string Audience { get; set; } = "phonehub-web";
    /// <summary>Bắt buộc đặt qua biến môi trường <c>Jwt__SigningKey</c> (≥ 32 ký tự).</summary>
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 14;
}

public class ShopOptions
{
    public decimal FreeShippingThreshold { get; set; } = 2_000_000m;
    public decimal ShippingFee { get; set; } = 30_000m;
    public int MaxQuantityPerItem { get; set; } = 5;
    /// <summary>URL frontend — dùng để redirect sau khi cổng thanh toán trả về.</summary>
    public string FrontendUrl { get; set; } = "http://localhost:5173";
    public string[] CorsOrigins { get; set; } = [];
}

public class PaymentOptions
{
    /// <summary>Các phương thức đang bật, ví dụ ["cod","sandbox"] hoặc ["cod","vnpay"].</summary>
    // Lưu ý: KHÔNG đặt giá trị mặc định cho mảng — config binder sẽ NỐI thêm phần tử từ appsettings (gây trùng).
    public string[] Providers { get; set; } = [];
    /// <summary>URL công khai của API (cổng thanh toán redirect về {PublicApiUrl}/api/payments/{provider}/return).</summary>
    public string PublicApiUrl { get; set; } = "http://localhost:5080";
    /// <summary>Số phút giữ đơn chờ thanh toán online trước khi tự hủy và hoàn kho.</summary>
    public int PendingTimeoutMinutes { get; set; } = 30;
    public SandboxOptions Sandbox { get; set; } = new();
    public VnPayOptions VnPay { get; set; } = new();

    public class SandboxOptions
    {
        /// <summary>Khóa HMAC ký callback của cổng giả lập — đặt qua <c>Payments__Sandbox__Secret</c>.</summary>
        public string Secret { get; set; } = "";
    }

    public class VnPayOptions
    {
        public string TmnCode { get; set; } = "";
        public string HashSecret { get; set; } = "";
        public string BaseUrl { get; set; } = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    }
}

public class SeedOptions
{
    public bool Enabled { get; set; } = true;
    public string AdminEmail { get; set; } = "admin@phonehub.local";
    /// <summary>Để trống → sinh ngẫu nhiên và in 1 lần ra console khi seed.</summary>
    public string AdminPassword { get; set; } = "";
    public string CustomerEmail { get; set; } = "khachhang@phonehub.local";
    public string CustomerPassword { get; set; } = "";
}
