using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;

namespace PhoneHub.Api.Payments;

public record PaymentCallback(bool SignatureValid, string TxnRef, decimal Amount, bool Success, string? ProviderTxnId, string? ResponseCode);

/// <summary>
/// Adapter cổng thanh toán. PhoneHub KHÔNG bao giờ nhận/lưu thông tin thẻ: khách nhập thẻ trên trang của cổng,
/// PhoneHub chỉ nhận kết quả đã ký và đối chiếu số tiền với bản ghi payments.
/// </summary>
public interface IPaymentGateway
{
    string Code { get; }
    string Name { get; }
    string Description { get; }
    bool IsOnline { get; }
    string? CreatePaymentUrl(Payment payment, Order order, string? clientIp);
    PaymentCallback ParseCallback(IQueryCollection query);
}

public class PaymentGatewayRegistry(IEnumerable<IPaymentGateway> gateways, IOptions<PaymentOptions> options)
{
    public IReadOnlyList<IPaymentGateway> Enabled =>
        (options.Value.Providers.Length == 0 ? ["cod"] : options.Value.Providers).Distinct()
            .Select(p => gateways.FirstOrDefault(g => g.Code == p)).OfType<IPaymentGateway>().ToList();

    public IPaymentGateway Get(string code) =>
        Enabled.FirstOrDefault(g => g.Code == code) ?? throw AppException.BadRequest("Phương thức thanh toán không khả dụng", "payment_method_invalid");
}

public class CodGateway : IPaymentGateway
{
    public string Code => "cod";
    public string Name => "Thanh toán khi nhận hàng (COD)";
    public string Description => "Trả tiền mặt hoặc chuyển khoản cho nhân viên giao hàng";
    public bool IsOnline => false;
    public string? CreatePaymentUrl(Payment payment, Order order, string? clientIp) => null;
    public PaymentCallback ParseCallback(IQueryCollection query) => throw new NotSupportedException();
}

/// <summary>Cổng giả lập để demo luồng thanh toán online (redirect → kết quả có chữ ký HMAC). Tắt ở production.</summary>
public class SandboxGateway(IOptions<PaymentOptions> options) : IPaymentGateway
{
    public string Code => "sandbox";
    public string Name => "Thẻ / Ví điện tử (Sandbox)";
    public string Description => "Cổng thanh toán thử nghiệm — không trừ tiền thật";
    public bool IsOnline => true;

    public string? CreatePaymentUrl(Payment payment, Order order, string? clientIp)
    {
        var amount = ((long)payment.Amount).ToString(CultureInfo.InvariantCulture);
        var sig = Sign($"{payment.TxnRef}|{amount}");
        return $"{options.Value.PublicApiUrl.TrimEnd('/')}/api/payments/sandbox/checkout?ref={payment.TxnRef}&amount={amount}&sig={sig}";
    }

    public string BuildResultUrl(string txnRef, string amount, string result) =>
        $"{options.Value.PublicApiUrl.TrimEnd('/')}/api/payments/sandbox/return?ref={WebUtility.UrlEncode(txnRef)}&amount={amount}&result={result}&sig={Sign($"{txnRef}|{amount}|{result}")}";

    public bool VerifyCheckout(string txnRef, string amount, string sig) => FixedEquals(Sign($"{txnRef}|{amount}"), sig);

    public PaymentCallback ParseCallback(IQueryCollection q)
    {
        string txnRef = q["ref"].ToString(), amount = q["amount"].ToString(), result = q["result"].ToString(), sig = q["sig"].ToString();
        var valid = FixedEquals(Sign($"{txnRef}|{amount}|{result}"), sig);
        decimal.TryParse(amount, NumberStyles.Integer, CultureInfo.InvariantCulture, out var amt);
        return new PaymentCallback(valid, txnRef, amt, result == "success", valid ? "SBX" + txnRef : null, result == "success" ? "00" : "24");
    }

    private string Sign(string data)
    {
        var secret = options.Value.Sandbox.Secret;
        if (string.IsNullOrWhiteSpace(secret)) throw new InvalidOperationException("Payments:Sandbox:Secret chưa được cấu hình");
        return Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(data)));
    }

    internal static bool FixedEquals(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(a.ToLowerInvariant()), Encoding.ASCII.GetBytes(b.ToLowerInvariant()));
}

/// <summary>VNPay v2.1.0 — ký HMAC-SHA512 trên query đã sắp xếp theo key.</summary>
public class VnPayGateway(IOptions<PaymentOptions> options, TimeProvider clock) : IPaymentGateway
{
    public string Code => "vnpay";
    public string Name => "VNPay (ATM / Visa / QR)";
    public string Description => "Thanh toán qua cổng VNPay";
    public bool IsOnline => true;

    public string? CreatePaymentUrl(Payment payment, Order order, string? clientIp)
    {
        var o = options.Value;
        var vn = TimeZoneInfo.ConvertTime(clock.GetUtcNow(), VietnamTz);
        var p = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["vnp_Version"] = "2.1.0",
            ["vnp_Command"] = "pay",
            ["vnp_TmnCode"] = o.VnPay.TmnCode,
            ["vnp_Amount"] = ((long)(payment.Amount * 100)).ToString(CultureInfo.InvariantCulture),
            ["vnp_CurrCode"] = "VND",
            ["vnp_TxnRef"] = payment.TxnRef,
            ["vnp_OrderInfo"] = $"Thanh toan don hang {order.Code}",
            ["vnp_OrderType"] = "other",
            ["vnp_Locale"] = "vn",
            ["vnp_ReturnUrl"] = $"{o.PublicApiUrl.TrimEnd('/')}/api/payments/vnpay/return",
            ["vnp_IpAddr"] = string.IsNullOrEmpty(clientIp) ? "127.0.0.1" : clientIp,
            ["vnp_CreateDate"] = vn.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture),
            ["vnp_ExpireDate"] = vn.AddMinutes(o.PendingTimeoutMinutes).ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture),
        };
        var query = BuildQuery(p);
        return $"{o.VnPay.BaseUrl}?{query}&vnp_SecureHash={Hmac512(o.VnPay.HashSecret, query)}";
    }

    public PaymentCallback ParseCallback(IQueryCollection q)
    {
        var p = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var (k, v) in q)
            if (k.StartsWith("vnp_", StringComparison.Ordinal) && k is not "vnp_SecureHash" and not "vnp_SecureHashType" && !string.IsNullOrEmpty(v))
                p[k] = v.ToString();

        var expected = Hmac512(options.Value.VnPay.HashSecret, BuildQuery(p));
        var valid = SandboxGateway.FixedEquals(expected, q["vnp_SecureHash"].ToString());
        decimal.TryParse(q["vnp_Amount"], NumberStyles.Integer, CultureInfo.InvariantCulture, out var amount100);
        var code = q["vnp_ResponseCode"].ToString();
        var success = code == "00" && q["vnp_TransactionStatus"].ToString() == "00";
        return new PaymentCallback(valid, q["vnp_TxnRef"].ToString(), amount100 / 100m, success, q["vnp_TransactionNo"].ToString(), code);
    }

    internal static string BuildQuery(SortedDictionary<string, string> p) =>
        string.Join('&', p.Where(kv => !string.IsNullOrEmpty(kv.Value)).Select(kv => $"{WebUtility.UrlEncode(kv.Key)}={WebUtility.UrlEncode(kv.Value)}"));

    internal static string Hmac512(string key, string data) =>
        Convert.ToHexStringLower(HMACSHA512.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(data)));

    private static readonly TimeZoneInfo VietnamTz = FindTz();
    private static TimeZoneInfo FindTz()
    {
        foreach (var id in new[] { "Asia/Ho_Chi_Minh", "SE Asia Standard Time" })
            if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out var tz)) return tz;
        return TimeZoneInfo.CreateCustomTimeZone("ICT", TimeSpan.FromHours(7), "ICT", "ICT");
    }
}
