using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace PhoneHub.Api.Infrastructure;

/// <summary>Lỗi nghiệp vụ có chủ đích — trả về client dưới dạng ProblemDetails với thông điệp tiếng Việt.</summary>
public class AppException(int status, string message, string? code = null) : Exception(message)
{
    public int Status { get; } = status;
    public string? Code { get; } = code;

    public static AppException NotFound(string message = "Không tìm thấy dữ liệu") => new(404, message, "not_found");
    public static AppException BadRequest(string message, string? code = null) => new(400, message, code ?? "bad_request");
    public static AppException Conflict(string message, string? code = null) => new(409, message, code ?? "conflict");
    public static AppException Unauthorized(string message = "Bạn cần đăng nhập") => new(401, message, "unauthorized");
    public static AppException Forbidden(string message = "Bạn không có quyền thực hiện thao tác này") => new(403, message, "forbidden");
}

public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception ex, CancellationToken ct)
    {
        ProblemDetails pd;
        if (ex is AppException app)
        {
            pd = new ProblemDetails { Status = app.Status, Title = app.Message, Detail = app.Message };
            if (app.Code is not null) pd.Extensions["code"] = app.Code;
        }
        else if (ex is Microsoft.EntityFrameworkCore.DbUpdateException dbEx && IsUniqueViolation(dbEx))
        {
            pd = new ProblemDetails { Status = 409, Title = "Dữ liệu bị trùng (mã/slug/email đã tồn tại)" };
            pd.Extensions["code"] = "duplicate";
        }
        else
        {
            // Không lộ stack trace / thông tin nội bộ ra client.
            logger.LogError(ex, "Unhandled exception on {Method} {Path}", http.Request.Method, http.Request.Path);
            pd = new ProblemDetails { Status = 500, Title = "Đã có lỗi xảy ra, vui lòng thử lại sau" };
        }

        http.Response.StatusCode = pd.Status!.Value;
        return await problems.TryWriteAsync(new ProblemDetailsContext { HttpContext = http, ProblemDetails = pd, Exception = ex });
    }

    private static bool IsUniqueViolation(Exception ex)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        return msg.Contains("Duplicate entry", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase);
    }
}
