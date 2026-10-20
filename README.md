# PhoneHub — Website bán điện thoại

Website TMĐT bán điện thoại: storefront (React) + REST API (ASP.NET Core 10) + MySQL. Mở bằng **Visual Studio 2022/2026** qua `PhoneHub.slnx`.

- Phân tích & kiến trúc: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- API contract: [docs/API.md](docs/API.md)

## 1. Tính năng

**Khách hàng**: trang chủ, danh mục / thương hiệu, tìm kiếm có gợi ý (debounce 300ms), bộ lọc (thương hiệu, giá, bộ nhớ, RAM, giảm giá) + sắp xếp + phân trang **đồng bộ với URL**, chi tiết sản phẩm (chọn màu × dung lượng, ảnh theo màu, tồn kho thời gian thực, thông số), so sánh tối đa 4 máy, wishlist, giỏ hàng (lưu ở server), checkout (sổ địa chỉ, mã giảm giá, COD / cổng thanh toán), lịch sử & chi tiết đơn, hủy đơn, thanh toán lại, đánh giá (chỉ khi đã nhận hàng), khuyến mãi, liên hệ, chính sách, tài khoản (hồ sơ, địa chỉ, đổi mật khẩu).

**Admin** (`/admin`): dashboard KPI (doanh thu, đơn, khách mới, AOV, đơn chờ, sắp hết hàng — so với kỳ trước), biểu đồ doanh thu theo ngày, đơn theo trạng thái, top sản phẩm; CRUD sản phẩm (biến thể, ảnh + upload, thông số), thương hiệu, danh mục, mã giảm giá; tồn kho; đơn hàng (chuyển trạng thái theo state machine); người dùng (phân quyền / khóa); kiểm duyệt đánh giá; tin nhắn liên hệ; nhật ký thao tác (audit log).

## 2. Cấu trúc thư mục

```
PhoneHub/
├── PhoneHub.slnx                  # Solution Visual Studio
├── docker-compose.yml             # MySQL 8.4
├── .env.example                   # mẫu biến môi trường (copy → .env)
├── dotnet-tools.json              # dotnet-ef (dotnet tool restore)
├── docs/                          # ARCHITECTURE.md, API.md
├── src/PhoneHub.Api/              # ASP.NET Core Web API
│   ├── Domain/                    # entity
│   ├── Data/                      # AppDbContext, Migrations (MySQL), Seed
│   ├── Contracts/                 # DTO + validation
│   ├── Services/                  # Auth, Pricing, Coupon, Cart, Order, Catalog, Audit
│   ├── Payments/                  # IPaymentGateway: cod / sandbox / vnpay
│   ├── Controllers/ (+ Admin/)
│   └── Infrastructure/            # options, lỗi, security headers, .env loader
├── src/phonehub-web/              # React 19 + TS + Vite + Tailwind v4 (+ .esproj)
│   └── src/{lib,components,pages,admin}
└── tests/PhoneHub.Api.Tests/      # xUnit: unit + integration
```

## 3. Yêu cầu

- .NET SDK 10 (Visual Studio 2022 17.14+/2026 đã kèm)
- Node.js ≥ 20 (Visual Studio có kèm Node; hoặc cài từ nodejs.org)
- MySQL 8.x — qua Docker (`docker compose`) hoặc cài trực tiếp

## 4. Cài đặt & chạy

### 4.1 Biến môi trường
```bash
copy .env.example .env
```
Điền **giá trị của bạn** vào `.env` (file này đã được gitignore):
- `Jwt__SigningKey` — chuỗi ngẫu nhiên ≥ 32 ký tự
- `Payments__Sandbox__Secret` — chuỗi ngẫu nhiên ≥ 16 ký tự
- `MYSQL_*` và `ConnectionStrings__Default` (cùng user/password)
- `Seed__AdminPassword`, `Seed__CustomerPassword` — mật khẩu tài khoản demo (≥ 8 ký tự, có hoa/thường/số)

Sinh khóa ngẫu nhiên bằng PowerShell:
```bash
powershell -c "[Convert]::ToBase64String((1..48 | % { Get-Random -Max 256 }))"
```

API tự đọc `.env` ở thư mục gốc khi chạy local; biến môi trường thật luôn được ưu tiên (dùng cho server).

### 4.2 MySQL
```bash
docker compose --env-file .env up -d
```
(Hoặc tạo database `phonehub` + user trên MySQL đã cài sẵn, collation `utf8mb4_unicode_ci`.)

### 4.3 Migration & seed
```bash
dotnet tool restore
dotnet ef database update -p src/PhoneHub.Api
```
API cũng tự `Migrate()` + seed khi khởi động (`Database:InitializeOnStartup=true`). Seed chỉ chạy khi DB chưa có dữ liệu và tạo: 8 thương hiệu, 5 danh mục, 21 điện thoại / 115 biến thể (ảnh SVG minh họa tự sinh), 6 mã giảm giá, đơn hàng + đánh giá mẫu 60 ngày gần nhất, và 2 tài khoản demo.

Tạo migration mới khi đổi model:
```bash
dotnet ef migrations add TenMigration -p src/PhoneHub.Api -o Data/Migrations
```

### 4.4 Chạy
**Visual Studio**: mở `PhoneHub.slnx` → chuột phải Solution → *Configure Startup Projects* → *Multiple startup projects*: `PhoneHub.Api` và `phonehub-web` = Start → F5.

**Dòng lệnh** (2 terminal):
```bash
dotnet run --project src/PhoneHub.Api --launch-profile http
```
```bash
cd src/phonehub-web && npm install && npm run dev
```
Mở http://localhost:5173 (Vite proxy `/api`, `/images`, `/uploads` → http://localhost:5080).

### 4.5 Tài khoản demo
Được **tạo bởi seed** với email `admin@phonehub.local` (quyền admin) và `khachhang@phonehub.local` (khách hàng), mật khẩu lấy từ `Seed__AdminPassword` / `Seed__CustomerPassword` trong `.env`.
Nếu để trống ở môi trường Development, seed sinh mật khẩu ngẫu nhiên và in **một lần** ra console của API; ở môi trường khác thiếu mật khẩu → API dừng khởi động. Repo không chứa mật khẩu nào.

### 4.6 Chạy thử không cần MySQL (chỉ để dev nhanh)
```bash
set Database__Provider=sqlite
set ConnectionStrings__Default=Data Source=phonehub-dev.db
dotnet run --project src/PhoneHub.Api --launch-profile http
```
SQLite dùng `EnsureCreated` (không qua migration) — **không dùng cho production**.

## 5. Kiểm thử
```bash
dotnet test tests/PhoneHub.Api.Tests
```
```bash
cd src/phonehub-web && npm test
```
- **Backend (38 test)**: tính giá/coupon/phí ship, state machine đơn, chữ ký VNPay & Sandbox (chống sửa tham số), magic bytes ảnh; integration chạy toàn pipeline API trên SQLite in-memory: đăng ký/đăng nhập, xoay vòng refresh token + phát hiện tái sử dụng, filter/sort/paging, tổng tiền tính ở server (bỏ qua giá client gửi), trừ kho nguyên tử (2 đơn tranh món cuối → 1 thành công), coupon giới hạn/hoàn lượt khi hủy, thanh toán sandbox + callback giả mạo bị từ chối + idempotent, phân quyền admin, CRUD sản phẩm + audit log, đánh giá chỉ sau khi giao, rate limit 429, chống vòng lặp danh mục.
- **Frontend (5 test)**: parse/serialize bộ lọc URL, định dạng tiền.
- `npm run build` chạy `tsc` strict trước khi build.

## 6. Bảo mật đã áp dụng
- Mật khẩu băm PBKDF2 (ASP.NET Identity `PasswordHasher`), so sánh thời gian đều khi email không tồn tại.
- Access token JWT 15 phút chỉ giữ trong bộ nhớ trình duyệt; refresh token 14 ngày trong cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`, DB chỉ lưu SHA-256, xoay vòng mỗi lần dùng, dùng lại token cũ → thu hồi cả chuỗi. Refresh/logout yêu cầu header `X-PhoneHub-Client` (buộc CORS preflight).
- Phân quyền `customer`/`admin` bằng role claim; mọi truy vấn của khách lọc theo `userId` (không IDOR).
- **Không tin client**: giỏ hàng chỉ nhận `variantId + quantity`; giá, giảm giá, phí ship, tổng tiền luôn tính lại ở `PricingService`; trừ kho bằng `UPDATE … WHERE quantity >= n` trong transaction.
- Callback thanh toán: xác thực HMAC, đối chiếu số tiền, idempotent; **không nhận/lưu thông tin thẻ**.
- Rate limiting (toàn cục 300/phút/IP, auth 10/phút, ghi 30/phút), validation DataAnnotations + zod phía client, lỗi trả ProblemDetails không lộ stack trace, security headers (CSP, X-Frame-Options, nosniff…), HSTS ở production, upload ảnh kiểm tra magic bytes + giới hạn 2MB + tên file ngẫu nhiên, chống open-redirect ở `?next=`.
- Không hardcode bí mật: API dừng khởi động nếu thiếu `Jwt:SigningKey` / secret cổng thanh toán.

## 7. Cấu hình thanh toán
`Payments__Providers` bật/tắt adapter: `cod`, `sandbox` (cổng giả lập để demo — **tắt ở production**), `vnpay` (cần `Payments__VnPay__TmnCode`, `Payments__VnPay__HashSecret`, `Payments__PublicApiUrl` công khai; IPN tại `/api/payments/vnpay/ipn`). Thêm cổng mới = cài `IPaymentGateway` + đăng ký DI. Đơn online chưa thanh toán sau `PendingTimeoutMinutes` (30') tự hủy và hoàn kho.

## 8. Phần còn thiếu / chưa kiểm chứng
- **Chưa chạy trên MySQL thật**: máy phát triển không có MySQL/Docker. Migration `InitialCreate` đã sinh cho MySQL nhưng chưa `database update` lên server thật; toàn bộ test + chạy thử end-to-end dùng SQLite.
- Adapter **VNPay** mới được kiểm chứng chữ ký bằng unit test, chưa thử với sandbox VNPay thật (cần tài khoản merchant).
- Chưa có: quên mật khẩu / xác thực email (cần dịch vụ gửi mail), mua hàng không cần đăng nhập (giỏ hàng yêu cầu tài khoản), lịch sử nhập/xuất kho (admin đặt số lượng tuyệt đối), hoàn tiền tự động.
- Ảnh upload lưu trên đĩa (`wwwroot/uploads`); rate limit lưu trong bộ nhớ từng instance — khi scale nhiều instance cần object storage + Redis.
- Chưa có test E2E tự động cho giao diện (đã kiểm tra thủ công trên trình duyệt: đăng nhập, lọc, chọn biến thể, giỏ, coupon, thanh toán sandbox, dashboard admin, phân quyền, mobile 375px).
- Sau reverse proxy cần cấu hình `ForwardedHeaders` KnownProxies để rate limit lấy đúng IP.
