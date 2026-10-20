using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PhoneHub.Api.Data;
using PhoneHub.Api.Data.Seed;
using PhoneHub.Api.Domain;
using PhoneHub.Api.Infrastructure;
using PhoneHub.Api.Payments;
using PhoneHub.Api.Services;

Console.OutputEncoding = Encoding.UTF8;

// .env ở thư mục gốc repo (chạy local / Visual Studio). Biến môi trường thật luôn được ưu tiên.
DotEnv.Load(".env", "../../.env", Path.Combine(AppContext.BaseDirectory, "../../../../../.env"));

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ───────────── Options (fail-fast khi thiếu bí mật) ─────────────
builder.Services.AddOptions<JwtOptions>().Bind(config.GetSection("Jwt"))
    .Validate(o => o.SigningKey.Length >= 32, "Jwt:SigningKey phải dài tối thiểu 32 ký tự (đặt qua biến môi trường Jwt__SigningKey)")
    .ValidateOnStart();
builder.Services.Configure<ShopOptions>(config.GetSection("Shop"));
builder.Services.AddOptions<PaymentOptions>().Bind(config.GetSection("Payments"))
    .Validate(o => !o.Providers.Contains("sandbox") || o.Sandbox.Secret.Length >= 16, "Payments:Sandbox:Secret tối thiểu 16 ký tự khi bật sandbox")
    .Validate(o => !o.Providers.Contains("vnpay") || (o.VnPay.TmnCode.Length > 0 && o.VnPay.HashSecret.Length > 0), "Thiếu cấu hình Payments:VnPay")
    .ValidateOnStart();
builder.Services.Configure<SeedOptions>(config.GetSection("Seed"));

// ───────────── Database ─────────────
var provider = config["Database:Provider"]?.ToLowerInvariant() ?? "mysql";
var connectionString = config.GetConnectionString("Default");
builder.Services.AddDbContext<AppDbContext>(o =>
{
    if (provider == "sqlite") o.UseSqlite(connectionString ?? "Data Source=phonehub-dev.db");
    else o.UseMySQL(connectionString ?? throw new InvalidOperationException("Thiếu ConnectionStrings__Default"));
});

// ───────────── Services ─────────────
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AuditService>();
builder.Services.AddScoped<PricingService>();
builder.Services.AddScoped<CouponService>();
builder.Services.AddScoped<CartService>();
builder.Services.AddScoped<CatalogService>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddScoped<DbSeeder>();
builder.Services.AddScoped<IPaymentGateway, CodGateway>();
builder.Services.AddScoped<IPaymentGateway, SandboxGateway>();
builder.Services.AddScoped<IPaymentGateway, VnPayGateway>();
builder.Services.AddScoped<PaymentGatewayRegistry>();
if (config.GetValue("Workers:Enabled", true)) builder.Services.AddHostedService<OrderExpiryWorker>();

// ───────────── Auth ─────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((o, jwt) =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Value.Issuer,
            ValidAudience = jwt.Value.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Value.SigningKey)),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "sub",
            RoleClaimType = "role",
        };
    });
builder.Services.AddAuthorization();

// ───────────── Rate limiting ─────────────
builder.Services.AddRateLimiter(o =>
{
    static string Key(HttpContext c) => c.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(c =>
        RateLimitPartition.GetFixedWindowLimiter(Key(c), _ => new FixedWindowRateLimiterOptions
            { PermitLimit = config.GetValue("RateLimit:GlobalPerMinute", 300), Window = TimeSpan.FromMinutes(1) }));
    o.AddPolicy("auth", c => RateLimitPartition.GetFixedWindowLimiter(Key(c), _ => new FixedWindowRateLimiterOptions
        { PermitLimit = config.GetValue("RateLimit:AuthPerMinute", 10), Window = TimeSpan.FromMinutes(1) }));
    o.AddPolicy("write", c => RateLimitPartition.GetFixedWindowLimiter(Key(c), _ => new FixedWindowRateLimiterOptions
        { PermitLimit = config.GetValue("RateLimit:WritePerMinute", 30), Window = TimeSpan.FromMinutes(1) }));
    o.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        await ctx.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = 429, Title = "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút",
        }, ct);
    };
});

// ───────────── MVC, lỗi, CORS ─────────────
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddControllers().ConfigureApiBehaviorOptions(o =>
{
    o.InvalidModelStateResponseFactory = ctx =>
    {
        var pd = new ValidationProblemDetails(ctx.ModelState) { Status = 400, Title = "Dữ liệu không hợp lệ" };
        pd.Extensions["code"] = "validation";
        return new BadRequestObjectResult(pd) { ContentTypes = { "application/problem+json" } };
    };
});
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(config.GetSection("Shop:CorsOrigins").Get<string[]>() ?? ["http://localhost:5173"])
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Chỉ tin proxy cấu hình rõ (mặc định: loopback) — tránh giả mạo IP để né rate limit.
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment()) app.UseHsts();
app.UseSecurityHeaders();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "public, max-age=604800",
});
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).DisableRateLimiting();

// ───────────── Khởi tạo DB + seed ─────────────
if (config.GetValue("Database:InitializeOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (db.Database.IsSqlite()) await db.Database.EnsureCreatedAsync();
    else await db.Database.MigrateAsync();
    if (config.GetValue("Seed:Enabled", true))
        await scope.ServiceProvider.GetRequiredService<DbSeeder>().SeedAsync(config.GetValue("Seed:DemoOrders", true));
}

app.Run();

public partial class Program;
