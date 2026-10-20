using System.ComponentModel.DataAnnotations;

namespace PhoneHub.Api.Contracts;

public record RegisterRequest(
    [Required(ErrorMessage = "Vui lòng nhập email"), EmailAddress(ErrorMessage = "Email không hợp lệ"), MaxLength(190)] string Email,
    [Required(ErrorMessage = "Vui lòng nhập mật khẩu"), StrongPassword] string Password,
    [Required(ErrorMessage = "Vui lòng nhập họ tên"), StringLength(120, MinimumLength = 2, ErrorMessage = "Họ tên từ 2–120 ký tự")] string FullName,
    [VnPhone] string? Phone);

public record LoginRequest(
    [Required(ErrorMessage = "Vui lòng nhập email"), EmailAddress(ErrorMessage = "Email không hợp lệ")] string Email,
    [Required(ErrorMessage = "Vui lòng nhập mật khẩu"), MaxLength(128)] string Password);

public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, StrongPassword] string NewPassword);

public record UpdateProfileRequest(
    [Required, StringLength(120, MinimumLength = 2)] string FullName,
    [VnPhone] string? Phone);

public record UserDto(int Id, string Email, string FullName, string? Phone, string Role, DateTime CreatedAt);

public record AuthResponse(string AccessToken, DateTime ExpiresAt, UserDto User);

public record AddressRequest(
    [Required(ErrorMessage = "Vui lòng nhập tên người nhận"), StringLength(120, MinimumLength = 2)] string RecipientName,
    [Required(ErrorMessage = "Vui lòng nhập số điện thoại"), VnPhone] string Phone,
    [Required(ErrorMessage = "Vui lòng nhập địa chỉ"), StringLength(255, MinimumLength = 5)] string Line1,
    [MaxLength(100)] string? Ward,
    [Required(ErrorMessage = "Vui lòng nhập quận/huyện"), MaxLength(100)] string District,
    [Required(ErrorMessage = "Vui lòng nhập tỉnh/thành"), MaxLength(100)] string Province,
    bool IsDefault);

public record AddressDto(int Id, string RecipientName, string Phone, string Line1, string Ward, string District, string Province, bool IsDefault);

public record ContactRequest(
    [Required(ErrorMessage = "Vui lòng nhập họ tên"), StringLength(120, MinimumLength = 2)] string Name,
    [Required(ErrorMessage = "Vui lòng nhập email"), EmailAddress(ErrorMessage = "Email không hợp lệ")] string Email,
    [VnPhone] string? Phone,
    [Required(ErrorMessage = "Vui lòng nhập tiêu đề"), StringLength(200, MinimumLength = 3)] string Subject,
    [Required(ErrorMessage = "Vui lòng nhập nội dung"), StringLength(4000, MinimumLength = 10, ErrorMessage = "Nội dung từ 10 ký tự")] string Message);

/// <summary>Tối thiểu 8 ký tự, có chữ hoa, chữ thường và số.</summary>
public sealed class StrongPasswordAttribute : ValidationAttribute
{
    public StrongPasswordAttribute() : base("Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số") { }

    public override bool IsValid(object? value) =>
        value is string s && s.Length is >= 8 and <= 128
        && s.Any(char.IsUpper) && s.Any(char.IsLower) && s.Any(char.IsDigit);
}

/// <summary>Số điện thoại Việt Nam: 10 số bắt đầu bằng 0, hoặc +84. Rỗng = hợp lệ (dùng kèm [Required] nếu bắt buộc).</summary>
public sealed class VnPhoneAttribute : ValidationAttribute
{
    private static readonly System.Text.RegularExpressions.Regex Rx = new(@"^(0|\+84)(3|5|7|8|9)\d{8}$");
    public VnPhoneAttribute() : base("Số điện thoại không hợp lệ") { }
    public override bool IsValid(object? value) => value is null || value is string { Length: 0 } || value is string s && Rx.IsMatch(s.Replace(" ", ""));
}
