using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PhoneHub.Api.Contracts;
using PhoneHub.Api.Data;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;

namespace PhoneHub.Api.Services;

public record AuthResult(AuthResponse Response, string RefreshToken, DateTime RefreshExpiresAt);

public class TokenService(IOptions<JwtOptions> options, TimeProvider clock)
{
    private readonly JwtOptions _opt = options.Value;

    public (string Token, DateTime ExpiresAt) CreateAccessToken(User user)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var expires = now.AddMinutes(_opt.AccessTokenMinutes);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opt.SigningKey));
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new Claim("role", user.Role),
            new Claim("name", user.FullName),
        };
        var token = new JwtSecurityToken(_opt.Issuer, _opt.Audience, claims, now, expires,
            new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    public static string NewRefreshToken() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(48));

    public static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

public class AuthService(AppDbContext db, TokenService tokens, IPasswordHasher<User> hasher, IOptions<JwtOptions> jwt,
    AuditService audit, TimeProvider clock, ILogger<AuthService> logger)
{
    // Hash giả để so sánh khi email không tồn tại → thời gian phản hồi đồng đều, tránh dò email.
    private static readonly string DummyHash = new PasswordHasher<User>().HashPassword(new User(), "dummy-Password1");

    public async Task<AuthResult> RegisterAsync(RegisterRequest req, string? ip)
    {
        var email = NormalizeEmail(req.Email);
        if (await db.Users.AnyAsync(u => u.Email == email))
            throw AppException.Conflict("Email đã được sử dụng", "email_taken");

        var user = new User { Email = email, FullName = req.FullName.Trim(), Phone = req.Phone?.Trim(), Role = Roles.Customer };
        user.PasswordHash = hasher.HashPassword(user, req.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        await audit.LogAsync(user.Id, "register", "user", user.Id.ToString(), null, ip);
        return await IssueAsync(user, Guid.NewGuid().ToString("N"), ip);
    }

    public async Task<AuthResult> LoginAsync(LoginRequest req, string? ip)
    {
        var email = NormalizeEmail(req.Email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null)
        {
            hasher.VerifyHashedPassword(new User(), DummyHash, req.Password);
            throw new AppException(401, "Email hoặc mật khẩu không đúng", "invalid_credentials");
        }

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            logger.LogWarning("Failed login for user {UserId} from {Ip}", user.Id, ip);
            throw new AppException(401, "Email hoặc mật khẩu không đúng", "invalid_credentials");
        }
        if (!user.IsActive) throw new AppException(403, "Tài khoản đã bị khóa", "account_locked");

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            user.PasswordHash = hasher.HashPassword(user, req.Password);

        await audit.LogAsync(user.Id, "login", "user", user.Id.ToString(), null, ip);
        return await IssueAsync(user, Guid.NewGuid().ToString("N"), ip);
    }

    /// <summary>
    /// Đổi refresh token lấy cặp token mới. Trả về <c>null</c> khi token không hợp lệ/hết hạn — đây là tình huống
    /// thường gặp (cookie cũ), nên không ném exception (tránh debugger dừng và tốn chi phí exception).
    /// </summary>
    public async Task<AuthResult?> RefreshAsync(string? refreshToken, string? ip)
    {
        if (string.IsNullOrEmpty(refreshToken)) return null;
        var now = clock.GetUtcNow().UtcDateTime;
        var hash = TokenService.Hash(refreshToken);
        var stored = await db.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == hash);
        if (stored is null) return null;

        if (stored.RevokedAt is not null)
        {
            // Token đã bị xoay vòng mà vẫn được dùng lại → nghi bị đánh cắp: thu hồi cả family.
            logger.LogWarning("Refresh token reuse detected for user {UserId}, family {Family}", stored.UserId, stored.FamilyId);
            await RevokeFamilyAsync(stored.FamilyId, now);
            await audit.LogAsync(stored.UserId, "refresh_reuse", "user", stored.UserId.ToString(), null, ip);
            return null;
        }
        if (stored.ExpiresAt <= now || !stored.User.IsActive) return null;

        var result = await IssueAsync(stored.User, stored.FamilyId, ip, save: false);
        stored.RevokedAt = now;
        stored.ReplacedByHash = TokenService.Hash(result.RefreshToken);
        await db.SaveChangesAsync();
        return result;
    }

    public async Task LogoutAsync(string? refreshToken)
    {
        if (string.IsNullOrEmpty(refreshToken)) return;
        var hash = TokenService.Hash(refreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
        if (stored is { RevokedAt: null })
        {
            stored.RevokedAt = clock.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync();
        }
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordRequest req, string? ip)
    {
        var user = await db.Users.FindAsync(userId) ?? throw AppException.NotFound();
        if (hasher.VerifyHashedPassword(user, user.PasswordHash, req.CurrentPassword) == PasswordVerificationResult.Failed)
            throw AppException.BadRequest("Mật khẩu hiện tại không đúng", "wrong_password");

        user.PasswordHash = hasher.HashPassword(user, req.NewPassword);
        user.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        var now = user.UpdatedAt;
        await db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));
        await db.SaveChangesAsync();
        await audit.LogAsync(userId, "change_password", "user", userId.ToString(), null, ip);
    }

    public static UserDto ToDto(User u) => new(u.Id, u.Email, u.FullName, u.Phone, u.Role, u.CreatedAt);

    private async Task<AuthResult> IssueAsync(User user, string familyId, string? ip, bool save = true)
    {
        var (access, expires) = tokens.CreateAccessToken(user);
        var refresh = TokenService.NewRefreshToken();
        var refreshExpires = clock.GetUtcNow().UtcDateTime.AddDays(jwt.Value.RefreshTokenDays);
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = TokenService.Hash(refresh),
            FamilyId = familyId,
            ExpiresAt = refreshExpires,
            CreatedAt = clock.GetUtcNow().UtcDateTime,
            CreatedByIp = ip,
        });
        if (save) await db.SaveChangesAsync();
        return new AuthResult(new AuthResponse(access, expires, ToDto(user)), refresh, refreshExpires);
    }

    private Task RevokeFamilyAsync(string familyId, DateTime now) =>
        db.RefreshTokens.Where(t => t.FamilyId == familyId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}

public class AuditService(AppDbContext db, TimeProvider clock)
{
    /// <summary>Ghi nhật ký ngay (SaveChanges riêng). Không ghi dữ liệu nhạy cảm vào <paramref name="data"/>.</summary>
    public async Task LogAsync(int? userId, string action, string entity, string? entityId, string? data, string? ip)
    {
        db.AuditLogs.Add(new AuditLog
        {
            UserId = userId, Action = action, Entity = entity, EntityId = entityId,
            Data = data is { Length: > 4000 } ? data[..4000] : data, Ip = ip, CreatedAt = clock.GetUtcNow().UtcDateTime,
        });
        await db.SaveChangesAsync();
    }
}
