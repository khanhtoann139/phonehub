# PhoneHub — Phân tích & kiến trúc (Giai đoạn 1)

## 1. Phạm vi
Website TMĐT bán điện thoại: khách xem/tìm/lọc/so sánh sản phẩm, wishlist, giỏ hàng, đặt hàng (COD hoặc
cổng thanh toán), theo dõi đơn, đánh giá. Admin quản trị sản phẩm/biến thể/tồn kho/thương hiệu/danh mục/
mã giảm giá/đơn hàng/người dùng/đánh giá, xem KPI + biểu đồ, nhật ký thao tác.

## 2. Stack (mở bằng Visual Studio 2022/2026 — `PhoneHub.slnx`)
| Tầng | Công nghệ |
|------|-----------|
| Backend | ASP.NET Core 10 Web API (controllers), EF Core 10 + `MySql.EntityFrameworkCore` (Oracle) |
| Auth | JWT access token (15') + refresh token xoay vòng trong cookie `HttpOnly; Secure; SameSite=Strict` (lưu **hash** SHA-256 trong DB, phát hiện tái sử dụng → thu hồi cả "family") |
| Mật khẩu | `PasswordHasher<T>` của ASP.NET Identity (PBKDF2-HMAC-SHA512, 100k vòng) |
| Bảo vệ | Rate limiting built-in (`auth` 10/phút/IP, `global` 300/phút/IP), security headers, CORS theo cấu hình, ProblemDetails cho lỗi, DataAnnotations validation |
| Thanh toán | `IPaymentGateway` adapter: `cod`, `sandbox` (cổng giả lập ký HMAC — dùng demo), `vnpay` (ký HMAC-SHA512 theo spec VNPay 2.1.0) — bật/tắt qua `Payments:Providers` |
| Frontend | React 19 + TypeScript + Vite 6, Tailwind CSS v4, React Router 7, TanStack Query 5, react-hook-form + zod, sonner (toast), recharts, lucide-react |
| DB | MySQL 8 (docker-compose có sẵn). Test tích hợp chạy SQLite in-memory cùng model EF |
| Test | xUnit + `WebApplicationFactory` (integration) + unit test cho `PricingService`/`PaymentSignature` |

## 3. Cấu trúc thư mục
```
PhoneHub/
├── PhoneHub.slnx                 # mở bằng Visual Studio
├── docker-compose.yml            # MySQL 8.4
├── .env.example                  # biến môi trường (KHÔNG chứa bí mật thật)
├── docs/ARCHITECTURE.md, API.md
├── src/PhoneHub.Api/
│   ├── Program.cs                # pipeline, DI, rate limit, auth
│   ├── Domain/                   # entity + enum
│   ├── Data/                     # AppDbContext, Migrations, Seed
│   ├── Contracts/                # DTO request/response (+ validation)
│   ├── Services/                 # Auth/Token, Pricing, Cart, Order, Inventory, Audit
│   ├── Payments/                 # IPaymentGateway + Cod/Sandbox/VnPay
│   ├── Controllers/              # public + /api/admin/*
│   └── Infrastructure/           # error handler, security headers, .env loader, extensions
├── src/phonehub-web/             # React + Vite (+ phonehub-web.esproj cho Visual Studio)
└── tests/PhoneHub.Api.Tests/
```

## 4. Database (chuẩn hóa, snake_case)
| Bảng | Ghi chú |
|------|---------|
| users | email unique, password_hash, role (customer/admin), is_active |
| refresh_tokens | token_hash unique, family_id, expires_at, revoked_at, replaced_by |
| addresses | FK user, is_default |
| brands, categories | slug unique; categories có parent_id |
| products | FK brand/category, slug unique, specs_json, is_active, is_featured, rating_avg, rating_count |
| product_variants | FK product, sku unique, color, color_hex, storage_gb, ram_gb, price, compare_at_price; unique(product, color, storage) |
| product_images | FK product, color (nullable — ảnh theo màu), url, alt, sort_order |
| inventory | PK = variant_id, quantity, low_stock_threshold — trừ kho bằng `UPDATE … WHERE quantity >= n` (nguyên tử) |
| carts, cart_items | 1 cart / user; unique(cart, variant) |
| wishlists | unique(user, product) |
| coupons | percent/fixed, max_discount, min_order, starts/ends, usage_limit, used_count, per_user_limit |
| orders | code unique, status, payment_method, payment_status, subtotal/discount/shipping/total (tính ở server), snapshot địa chỉ |
| order_items | snapshot tên/sku/giá tại thời điểm mua |
| payments | provider, amount, status, txn_ref unique, provider_txn_id — **không lưu thông tin thẻ** |
| reviews | unique(user, product), chỉ khi đã mua & đơn `Delivered`; is_approved |
| contact_messages | form liên hệ |
| audit_logs | user, action, entity, entity_id, data, ip |

## 5. Quy tắc nghiệp vụ then chốt
- **Không tin giá từ client**: giỏ hàng chỉ gửi `variantId + quantity`; `PricingService` tính lại subtotal,
  giảm giá coupon, phí ship (miễn phí từ `Shop:FreeShippingThreshold`), tổng.
- Đặt hàng trong transaction: kiểm tra giá/tồn → trừ kho nguyên tử → tăng `used_count` coupon có điều kiện →
  tạo order + payment → xóa giỏ. Hủy đơn / thanh toán thất bại → hoàn kho.
- Trạng thái đơn: `Pending → Confirmed → Shipping → Delivered`; `Pending/Confirmed → Cancelled`.
  Đơn online: `AwaitingPayment → Pending` khi callback hợp lệ.
- Callback cổng thanh toán xác thực chữ ký + số tiền + idempotent.
