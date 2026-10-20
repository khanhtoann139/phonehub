using System.Globalization;
using System.Net;

namespace PhoneHub.Api.Data.Seed;

/// <summary>
/// Sinh ảnh minh họa SVG (nhẹ, sắc nét mọi độ phân giải) cho dữ liệu demo — tránh dùng ảnh có bản quyền.
/// Admin có thể thay bằng ảnh thật qua trang quản trị (upload).
/// </summary>
public static class PhoneImageGenerator
{
    public static string Svg(string name, string brand, string colorHex, string style, int angle)
    {
        var dark = Shade(colorHex, -0.35);
        var light = Shade(colorHex, 0.25);
        var title = WebUtility.HtmlEncode(name);
        var brandText = WebUtility.HtmlEncode(brand.ToUpperInvariant());

        // angle 0: mặt trước, 1: mặt lưng
        var body = angle == 0
            ? $"""
               <rect x="150" y="60" width="300" height="600" rx="48" fill="url(#frame)"/>
               <rect x="162" y="72" width="276" height="576" rx="38" fill="#0b1020"/>
               <rect x="170" y="80" width="260" height="560" rx="32" fill="url(#screen)"/>
               <rect x="262" y="94" width="76" height="22" rx="11" fill="#05070f"/>
               <text x="300" y="300" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="58" font-weight="300" fill="#fff" opacity=".95">09:41</text>
               <text x="300" y="336" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="18" fill="#fff" opacity=".75">{brandText}</text>
               """
            : $"""
               <rect x="150" y="60" width="300" height="600" rx="48" fill="url(#back)"/>
               <rect x="150" y="60" width="300" height="600" rx="48" fill="none" stroke="{dark}" stroke-width="6"/>
               {CameraBlock(style, dark)}
               <text x="300" y="560" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="22" letter-spacing="6" fill="{dark}" opacity=".7">{brandText}</text>
               """;

        return $"""
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 720" role="img" aria-label="{title}">
              <defs>
                <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{light}"/><stop offset="1" stop-color="{dark}"/></linearGradient>
                <linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{light}"/><stop offset=".55" stop-color="{colorHex}"/><stop offset="1" stop-color="{dark}"/></linearGradient>
                <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset=".5" stop-color="#2563eb"/><stop offset="1" stop-color="{colorHex}"/></linearGradient>
                <radialGradient id="lens"><stop offset="0" stop-color="#3b4a6b"/><stop offset=".6" stop-color="#0b1020"/><stop offset="1" stop-color="#000"/></radialGradient>
                <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#1e3a8a" flood-opacity=".18"/></filter>
              </defs>
              <g filter="url(#sh)">{body}</g>
            </svg>
            """;
    }

    private static string CameraBlock(string style, string dark) => style switch
    {
        "triple-square" => $"""
            <rect x="178" y="92" width="150" height="150" rx="36" fill="{dark}" opacity=".35"/>
            <circle cx="220" cy="134" r="28" fill="url(#lens)"/><circle cx="286" cy="134" r="28" fill="url(#lens)"/><circle cx="220" cy="200" r="28" fill="url(#lens)"/>
            <circle cx="286" cy="200" r="10" fill="#fef3c7" opacity=".8"/>
            """,
        "vertical" => """
            <circle cx="212" cy="120" r="30" fill="url(#lens)"/><circle cx="212" cy="190" r="30" fill="url(#lens)"/><circle cx="212" cy="260" r="30" fill="url(#lens)"/>
            <circle cx="262" cy="120" r="8" fill="#fef3c7" opacity=".8"/>
            """,
        "bar" => $"""
            <rect x="162" y="120" width="276" height="70" rx="35" fill="{dark}" opacity=".55"/>
            <circle cx="220" cy="155" r="24" fill="url(#lens)"/><circle cx="280" cy="155" r="24" fill="url(#lens)"/><circle cx="380" cy="155" r="10" fill="#fef3c7" opacity=".8"/>
            """,
        "fold" => $"""
            <line x1="300" y1="64" x2="300" y2="656" stroke="{dark}" stroke-width="4" opacity=".5"/>
            <rect x="330" y="92" width="96" height="180" rx="30" fill="{dark}" opacity=".35"/>
            <circle cx="378" cy="130" r="22" fill="url(#lens)"/><circle cx="378" cy="182" r="22" fill="url(#lens)"/><circle cx="378" cy="234" r="22" fill="url(#lens)"/>
            """,
        _ => $"""
            <circle cx="300" cy="190" r="92" fill="{dark}" opacity=".35"/>
            <circle cx="262" cy="160" r="28" fill="url(#lens)"/><circle cx="338" cy="160" r="28" fill="url(#lens)"/><circle cx="262" cy="226" r="28" fill="url(#lens)"/><circle cx="338" cy="226" r="28" fill="url(#lens)"/>
            """,
    };

    private static string Shade(string hex, double amount)
    {
        var r = int.Parse(hex.AsSpan(1, 2), NumberStyles.HexNumber);
        var g = int.Parse(hex.AsSpan(3, 2), NumberStyles.HexNumber);
        var b = int.Parse(hex.AsSpan(5, 2), NumberStyles.HexNumber);
        int Adj(int c) => (int)Math.Clamp(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount, 0, 255);
        return $"#{Adj(r):x2}{Adj(g):x2}{Adj(b):x2}";
    }
}
