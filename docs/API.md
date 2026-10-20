# PhoneHub REST API contract

Base: `/api`. JSON camelCase. Lỗi trả `application/problem+json` (RFC 9457) với `errors` cho lỗi validation.
Danh sách phân trang: `{ items, page, pageSize, total, totalPages }`.
Auth: header `Authorization: Bearer <accessToken>`; refresh token nằm trong cookie `ph_rt` (HttpOnly, path `/api/auth`).

## Auth — rate limit `auth`
| Method | Path | Mô tả |
|--------|------|-------|
| POST | /auth/register | `{email, password, fullName, phone?}` → `{accessToken, user}` + set cookie |
| POST | /auth/login | `{email, password}` → `{accessToken, user}` + set cookie |
| POST | /auth/refresh | cookie → `{accessToken, user}` (xoay vòng refresh token) |
| POST | /auth/logout | thu hồi refresh token, xóa cookie |
| GET | /auth/me | user hiện tại |

## Catalog (public)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | /brands, /categories | danh sách |
| GET | /products | query: `q, brand (slug, nhiều giá trị phẩy), category, minPrice, maxPrice, storage (64,128…), ram, sort (newest\|price_asc\|price_desc\|rating\|popular), page, pageSize, featured, onSale` → `{items, …, facets}` |
| GET | /products/suggest?q= | gợi ý nhanh (tối đa 6) |
| GET | /products/{slug} | chi tiết + variants (giá, tồn kho khả dụng) + images + specs |
| GET | /products/compare?ids=1,2,3 | tối đa 4 sản phẩm, có specs |
| GET | /products/{id}/reviews?page= | đánh giá đã duyệt + phân bố sao |
| POST | /products/{id}/reviews 🔒 | `{rating, title?, content}` — chỉ khi đã nhận hàng |
| GET | /promotions | coupon công khai đang hiệu lực + sản phẩm giảm giá |
| POST | /contact | `{name, email, phone?, subject, message}` |

## Customer 🔒
| Method | Path | Mô tả |
|--------|------|-------|
| GET/PUT | /account/profile | `{fullName, phone}` |
| POST | /account/change-password | `{currentPassword, newPassword}` (thu hồi mọi refresh token) |
| GET/POST/PUT/DELETE | /account/addresses[/{id}] | sổ địa chỉ |
| GET | /wishlist | danh sách sản phẩm |
| POST/DELETE | /wishlist/{productId} | thêm / bỏ |
| GET | /cart | giỏ hàng với giá **tính ở server** + cảnh báo hết hàng |
| POST | /cart/items | `{variantId, quantity}` |
| PUT/DELETE | /cart/items/{variantId} | `{quantity}` |
| POST | /checkout/preview | `{couponCode?}` → subtotal/discount/shipping/total |
| POST | /orders | `{addressId \| address, paymentMethod (cod\|sandbox\|vnpay), couponCode?, note?}` → `{order, paymentUrl?}` |
| GET | /orders, /orders/{code} | lịch sử + chi tiết |
| POST | /orders/{code}/cancel | hủy đơn Pending/AwaitingPayment |
| POST | /orders/{code}/pay | tạo lại link thanh toán cho đơn AwaitingPayment |

## Payments (public, xác thực bằng chữ ký)
| GET | /payments/{provider}/return | cổng redirect về → cập nhật & chuyển hướng frontend `/payment/result` |
| GET | /payments/sandbox/checkout?ref= | trang cổng giả lập (demo) |
| GET | /payments/methods | các phương thức đang bật |

## Admin 🔒 role=admin — `/api/admin`
| Path | Mô tả |
|------|-------|
| GET /dashboard?days=30 | KPI (doanh thu, đơn, khách mới, AOV, sắp hết hàng), doanh thu theo ngày, đơn theo trạng thái, top sản phẩm |
| /products CRUD | kèm variants + images; `PUT /products/{id}/variants` thay thế danh sách biến thể |
| POST /uploads | upload ảnh (jpg/png/webp ≤ 2MB, kiểm tra magic bytes) |
| /brands, /categories, /coupons CRUD | |
| GET /inventory, PUT /inventory/{variantId} | `{quantity, lowStockThreshold}` |
| GET /orders, GET /orders/{code}, PUT /orders/{code}/status | đổi trạng thái theo state machine |
| GET /users, PUT /users/{id} | đổi role / khóa tài khoản |
| GET /reviews, PUT /reviews/{id} (`isApproved`), DELETE | kiểm duyệt |
| GET /contacts | tin nhắn liên hệ |
| GET /audit-logs | nhật ký |
