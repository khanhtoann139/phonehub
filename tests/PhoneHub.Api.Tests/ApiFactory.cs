using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using PhoneHub.Api.Contracts;
using PhoneHub.Api.Data;

namespace PhoneHub.Api.Tests;

/// <summary>
/// Chạy API thật (toàn bộ pipeline: auth, validation, rate limit, EF Core) trên SQLite in-memory.
/// Mỗi factory = một database riêng, seed đầy đủ catalog + tài khoản demo.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    public const string AdminEmail = "admin@test.local";
    public const string AdminPassword = "AdminPass123";
    public const string CustomerEmail = "customer@test.local";
    public const string CustomerPassword = "CustomerPass123";

    private readonly string _connString = $"Data Source=file:phonehub-{Guid.NewGuid():N}?mode=memory&cache=shared";
    private readonly SqliteConnection _keepAlive;
    public int AuthLimit { get; init; } = 1000;

    public ApiFactory()
    {
        _keepAlive = new SqliteConnection(_connString);
        _keepAlive.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Database:Provider", "sqlite");
        builder.UseSetting("ConnectionStrings:Default", _connString);
        builder.UseSetting("Jwt:SigningKey", "integration-test-signing-key-0123456789abcdef");
        builder.UseSetting("Payments:Sandbox:Secret", "integration-sandbox-secret");
        builder.UseSetting("Payments:PublicApiUrl", "http://localhost");
        builder.UseSetting("Shop:FrontendUrl", "http://frontend.test");
        builder.UseSetting("Seed:AdminEmail", AdminEmail);
        builder.UseSetting("Seed:AdminPassword", AdminPassword);
        builder.UseSetting("Seed:CustomerEmail", CustomerEmail);
        builder.UseSetting("Seed:CustomerPassword", CustomerPassword);
        builder.UseSetting("Seed:DemoOrders", "false");
        builder.UseSetting("Workers:Enabled", "false");
        builder.UseSetting("RateLimit:AuthPerMinute", AuthLimit.ToString());
        builder.UseSetting("RateLimit:WritePerMinute", "1000");
        builder.UseSetting("RateLimit:GlobalPerMinute", "100000");
    }

    public T WithDb<T>(Func<AppDbContext, T> f)
    {
        using var scope = Services.CreateScope();
        return f(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    public async Task<HttpClient> LoginAsync(string email, string password)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false, AllowAutoRedirect = false });
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var auth = (await res.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }

    public async Task<HttpClient> RegisterAsync(string? email = null)
    {
        email ??= $"user{Guid.NewGuid():N}"[..16] + "@test.local";
        var client = CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false, AllowAutoRedirect = false });
        var res = await client.PostAsJsonAsync("/api/auth/register", new { email, password = "Password123", fullName = "Người Thử Nghiệm", phone = "0912345678" });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var auth = (await res.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _keepAlive.Dispose();
    }
}

public static class HttpTestExtensions
{
    public static string? GetCookie(this HttpResponseMessage res, string name) =>
        res.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.Select(v => v.Split(';')[0]).Where(v => v.StartsWith(name + "=")).Select(v => v[(name.Length + 1)..]).FirstOrDefault()
            : null;
}
