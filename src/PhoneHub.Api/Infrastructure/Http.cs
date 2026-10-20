using System.Globalization;
using System.Security.Claims;
using System.Text;

namespace PhoneHub.Api.Infrastructure;

public static class HttpExtensions
{
    public static int GetUserId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var id)
            ? id
            : throw AppException.Unauthorized();

    public static int? TryGetUserId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var id) ? id : null;

    public static string? ClientIp(this HttpContext http) => http.Connection.RemoteIpAddress?.ToString();
}

public static class SecurityHeaders
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) => app.Use(async (ctx, next) =>
    {
        var h = ctx.Response.Headers;
        h["X-Content-Type-Options"] = "nosniff";
        h["X-Frame-Options"] = "DENY";
        h["Referrer-Policy"] = "strict-origin-when-cross-origin";
        h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        h["Cross-Origin-Opener-Policy"] = "same-origin";
        // API chỉ trả JSON/ảnh; trang cổng giả lập tự đặt CSP riêng. Ngoài /api (vd. trang chờ SPA proxy khi dev) không áp CSP chặt.
        if (ctx.Request.Path.StartsWithSegments("/api") && !h.ContainsKey("Content-Security-Policy"))
            h["Content-Security-Policy"] = "default-src 'none'; img-src 'self' data:; frame-ancestors 'none'";
        await next();
    });
}

public record Paged<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total)
{
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(Total / (double)PageSize);
}

public static class Slug
{
    public static string From(string text)
    {
        var normalized = text.Replace('đ', 'd').Replace('Đ', 'D').Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        var dash = false;
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsAsciiLetterOrDigit(c)) { sb.Append(char.ToLowerInvariant(c)); dash = false; }
            else if (!dash && sb.Length > 0) { sb.Append('-'); dash = true; }
        }
        return sb.ToString().Trim('-');
    }
}
