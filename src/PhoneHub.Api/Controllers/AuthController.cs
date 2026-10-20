using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using PhoneHub.Api.Contracts;
using PhoneHub.Api.Data;
using PhoneHub.Api.Infrastructure;
using PhoneHub.Api.Services;

namespace PhoneHub.Api.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("auth")]
public class AuthController(AuthService auth, AppDbContext db, IConfiguration config) : ControllerBase
{
    public const string RefreshCookie = "ph_rt";
    /// <summary>Header tùy biến bắt buộc cho refresh/logout → trình duyệt phải preflight CORS (chống CSRF bổ sung cho SameSite=Strict).</summary>
    public const string ClientHeader = "X-PhoneHub-Client";

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest req)
    {
        var result = await auth.RegisterAsync(req, HttpContext.ClientIp());
        SetRefreshCookie(result.RefreshToken, result.RefreshExpiresAt);
        return Ok(result.Response);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var result = await auth.LoginAsync(req, HttpContext.ClientIp());
        SetRefreshCookie(result.RefreshToken, result.RefreshExpiresAt);
        return Ok(result.Response);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh()
    {
        RequireClientHeader();
        // Chưa từng đăng nhập (không có cookie) → không phải lỗi, chỉ là khách vãng lai.
        if (string.IsNullOrEmpty(Request.Cookies[RefreshCookie])) return NoContent();
        var result = await auth.RefreshAsync(Request.Cookies[RefreshCookie], HttpContext.ClientIp());
        if (result is null)
        {
            ClearRefreshCookie();
            return Problem(statusCode: 401, title: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
        }
        SetRefreshCookie(result.RefreshToken, result.RefreshExpiresAt);
        return Ok(result.Response);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        RequireClientHeader();
        await auth.LogoutAsync(Request.Cookies[RefreshCookie]);
        ClearRefreshCookie();
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    [DisableRateLimiting]
    public async Task<ActionResult<UserDto>> Me()
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == User.GetUserId() && u.IsActive)
                   ?? throw AppException.Unauthorized();
        return AuthService.ToDto(user);
    }

    private void RequireClientHeader()
    {
        if (!Request.Headers.ContainsKey(ClientHeader)) throw AppException.Forbidden("Yêu cầu không hợp lệ");
    }

    private CookieOptions CookieOpts(DateTimeOffset? expires) => new()
    {
        HttpOnly = true,
        Secure = config.GetValue("Auth:CookieSecure", true),
        SameSite = SameSiteMode.Strict,
        Path = "/api/auth",
        Expires = expires,
        IsEssential = true,
    };

    private void SetRefreshCookie(string token, DateTime expires) => Response.Cookies.Append(RefreshCookie, token, CookieOpts(expires));
    private void ClearRefreshCookie() => Response.Cookies.Delete(RefreshCookie, CookieOpts(null));
}
