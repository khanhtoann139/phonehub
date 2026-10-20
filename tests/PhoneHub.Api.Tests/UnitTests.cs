using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;
using PhoneHub.Api.Controllers.Admin;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;
using PhoneHub.Api.Payments;
using PhoneHub.Api.Services;

namespace PhoneHub.Api.Tests;

public class PricingTests
{
    private readonly PricingService _pricing = new(Options.Create(new ShopOptions { FreeShippingThreshold = 2_000_000, ShippingFee = 30_000 }));

    [Fact]
    public void Subtotal_and_free_shipping_above_threshold()
    {
        var r = _pricing.Calculate([new PriceLine(1, 10_000_000, 2), new PriceLine(2, 500_000, 1)], null);
        Assert.Equal(20_500_000, r.Subtotal);
        Assert.Equal(0, r.ShippingFee);
        Assert.Equal(20_500_000, r.Total);
    }

    [Fact]
    public void Shipping_fee_applies_below_threshold_after_discount()
    {
        var coupon = new Coupon { Type = CouponType.Fixed, Value = 200_000 };
        var r = _pricing.Calculate([new PriceLine(1, 2_100_000, 1)], coupon);
        Assert.Equal(200_000, r.DiscountAmount);
        Assert.Equal(30_000, r.ShippingFee); // 1.900.000 < 2.000.000
        Assert.Equal(1_930_000, r.Total);
    }

    [Fact]
    public void Percent_coupon_is_capped_by_max_discount()
    {
        var coupon = new Coupon { Type = CouponType.Percent, Value = 10, MaxDiscount = 500_000 };
        Assert.Equal(500_000, PricingService.CouponDiscount(coupon, 30_000_000));
        Assert.Equal(100_000, PricingService.CouponDiscount(coupon, 1_000_000));
    }

    [Fact]
    public void Fixed_coupon_never_exceeds_subtotal()
    {
        var coupon = new Coupon { Type = CouponType.Fixed, Value = 5_000_000 };
        Assert.Equal(1_000_000, PricingService.CouponDiscount(coupon, 1_000_000));
    }

    [Fact]
    public void Empty_cart_has_no_shipping() => Assert.Equal(0, _pricing.Calculate([], null).Total);
}

public class DomainTests
{
    [Theory]
    [InlineData(OrderStatus.Pending, OrderStatus.Confirmed, true)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Shipping, true)]
    [InlineData(OrderStatus.Shipping, OrderStatus.Delivered, true)]
    [InlineData(OrderStatus.Shipping, OrderStatus.Cancelled, false)]
    [InlineData(OrderStatus.Delivered, OrderStatus.Pending, false)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Pending, false)]
    public void Order_state_machine(string from, string to, bool allowed) => Assert.Equal(allowed, OrderStatus.CanTransition(from, to));

    [Theory]
    [InlineData("Điện thoại gập", "dien-thoai-gap")]
    [InlineData("iPhone 17 Pro Max", "iphone-17-pro-max")]
    [InlineData("  Xanh Đậm!! ", "xanh-dam")]
    public void Slug_strips_vietnamese_diacritics(string input, string expected) => Assert.Equal(expected, Slug.From(input));

    [Fact]
    public void Image_magic_bytes_detection()
    {
        Assert.Equal(".png", AdminCommerceController.DetectImage([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]));
        Assert.Equal(".jpg", AdminCommerceController.DetectImage([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]));
        Assert.Null(AdminCommerceController.DetectImage("<svg onload=x>"u8.ToArray()));
    }
}

public class PaymentSignatureTests
{
    private static readonly IOptions<PaymentOptions> Opt = Options.Create(new PaymentOptions
    {
        PublicApiUrl = "https://api.test",
        Sandbox = new() { Secret = "unit-test-sandbox-secret" },
        VnPay = new() { TmnCode = "TEST01", HashSecret = "UNITTESTHASHSECRET" },
    });

    private static IQueryCollection QueryOf(string url) =>
        new QueryCollection(Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(new Uri(url).Query));

    [Fact]
    public void VnPay_signature_roundtrip_and_tamper_detection()
    {
        var gw = new VnPayGateway(Opt, TimeProvider.System);
        var url = gw.CreatePaymentUrl(new Payment { TxnRef = "PH1-1", Amount = 1_234_000 }, new Order { Code = "PH1" }, "127.0.0.1")!;
        var query = QueryOf(url).ToDictionary(kv => kv.Key, kv => kv.Value);

        // Mô phỏng VNPay trả về: ký lại toàn bộ tham số trả về bằng cùng secret.
        query["vnp_ResponseCode"] = "00";
        query["vnp_TransactionStatus"] = "00";
        query["vnp_TransactionNo"] = "999";
        var signed = new SortedDictionary<string, string>(query.Where(kv => kv.Key != "vnp_SecureHash").ToDictionary(kv => kv.Key, kv => kv.Value.ToString()), StringComparer.Ordinal);
        query["vnp_SecureHash"] = VnPayGateway.Hmac512("UNITTESTHASHSECRET", VnPayGateway.BuildQuery(signed));

        var ok = gw.ParseCallback(new QueryCollection(query));
        Assert.True(ok.SignatureValid);
        Assert.True(ok.Success);
        Assert.Equal(1_234_000, ok.Amount);

        query["vnp_Amount"] = new StringValues("100");
        Assert.False(gw.ParseCallback(new QueryCollection(query)).SignatureValid);
    }

    [Fact]
    public void Sandbox_result_link_cannot_be_tampered()
    {
        var gw = new SandboxGateway(Opt);
        var success = QueryOf(gw.BuildResultUrl("PH2-1", "500000", "success"));
        Assert.True(gw.ParseCallback(success).SignatureValid);

        var forged = success.ToDictionary(kv => kv.Key, kv => kv.Value);
        forged["amount"] = "1";
        Assert.False(gw.ParseCallback(new QueryCollection(forged)).SignatureValid);
    }
}
