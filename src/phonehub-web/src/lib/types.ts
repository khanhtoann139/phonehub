// Kiểu dữ liệu khớp với DTO của PhoneHub.Api (docs/API.md)

export interface Paged<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }

export interface User { id: number; email: string; fullName: string; phone?: string | null; role: 'customer' | 'admin'; createdAt: string }
export interface AuthResponse { accessToken: string; expiresAt: string; user: User }

export interface Brand { id: number; name: string; slug: string; logoUrl?: string | null; description?: string | null; productCount: number }
export interface Category { id: number; name: string; slug: string; description?: string | null; parentId?: number | null; productCount: number }

export interface ProductCard {
  id: number; name: string; slug: string; brandName: string; brandSlug: string; imageUrl?: string | null
  price: number; compareAtPrice?: number | null; ratingAvg: number; ratingCount: number
  colors: string[]; storages: number[]; inStock: boolean; isFeatured: boolean
}
export interface FacetItem { value: string; label: string; count: number }
export interface ProductFacets { brands: FacetItem[]; storages: FacetItem[]; rams: FacetItem[]; minPrice: number; maxPrice: number }
export interface ProductList extends Paged<ProductCard> { facets: ProductFacets }

export interface Variant { id: number; sku: string; color: string; colorHex: string; storageGb: number; ramGb: number; price: number; compareAtPrice?: number | null; stock: number; isActive: boolean }
export interface ProductImage { id: number; url: string; alt: string; color?: string | null; sortOrder: number }
export interface ProductDetail {
  id: number; name: string; slug: string; shortDescription: string; description: string
  brand: Brand; category: Category; specs: Record<string, string>
  ratingAvg: number; ratingCount: number; soldCount: number; isFeatured: boolean
  variants: Variant[]; images: ProductImage[]
}
export interface CompareItem { id: number; name: string; slug: string; imageUrl?: string | null; brandName: string; minPrice: number; ratingAvg: number; ratingCount: number; storages: string[]; colors: string[]; specs: Record<string, string> }

export interface Review { id: number; rating: number; title?: string | null; content: string; authorName: string; isVerifiedPurchase: boolean; createdAt: string }
export interface ReviewList extends Paged<Review> { average: number; count: number; distribution: number[]; canReview: boolean; hasReviewed: boolean }

export interface PublicCoupon { code: string; description: string; type: 'percent' | 'fixed'; value: number; maxDiscount?: number | null; minOrderAmount: number; endsAt: string }
export interface Promotions { coupons: PublicCoupon[]; saleProducts: ProductCard[] }

export interface CartItem {
  variantId: number; productId: number; productName: string; productSlug: string; variantName: string; sku: string; imageUrl?: string | null
  unitPrice: number; compareAtPrice?: number | null; quantity: number; lineTotal: number; stock: number; issue?: string | null
}
export interface Cart { items: CartItem[]; itemCount: number; subtotal: number; shippingFee: number; total: number; hasIssues: boolean }
export interface CheckoutPreview { items: CartItem[]; subtotal: number; discountAmount: number; shippingFee: number; total: number; couponCode?: string | null; couponMessage?: string | null; couponApplied: boolean }

export interface Address { id: number; recipientName: string; phone: string; line1: string; ward: string; district: string; province: string; isDefault: boolean }
export interface PaymentMethod { code: string; name: string; description: string; isOnline: boolean }

export type OrderStatus = 'AwaitingPayment' | 'Pending' | 'Confirmed' | 'Shipping' | 'Delivered' | 'Cancelled'
export interface OrderSummary { code: string; status: OrderStatus; paymentMethod: string; paymentStatus: string; total: number; itemCount: number; firstItemName?: string | null; firstItemImage?: string | null; createdAt: string }
export interface OrderItem { variantId?: number | null; productId: number; productName: string; productSlug: string; variantName: string; sku: string; imageUrl?: string | null; unitPrice: number; quantity: number; lineTotal: number }
export interface Payment { provider: string; amount: number; status: string; txnRef: string; createdAt: string; paidAt?: string | null }
export interface OrderDetail {
  code: string; status: OrderStatus; paymentMethod: string; paymentStatus: string
  subtotal: number; discountAmount: number; shippingFee: number; total: number; couponCode?: string | null
  shipName: string; shipPhone: string; shipAddress: string; note?: string | null; cancelReason?: string | null
  createdAt: string; updatedAt: string; items: OrderItem[]; payments: Payment[]; canCancel: boolean; canPay: boolean
  customerEmail?: string | null; customerName?: string | null
}
export interface PlaceOrderResponse { order: OrderDetail; paymentUrl?: string | null }

// Admin
export interface AdminBrand { id: number; name: string; slug: string; logoUrl?: string | null; description?: string | null; sortOrder: number; isActive: boolean; productCount: number }
export interface AdminCategory { id: number; name: string; slug: string; description?: string | null; parentId?: number | null; sortOrder: number; isActive: boolean; productCount: number }
export interface AdminProductRow { id: number; name: string; slug: string; brandName: string; categoryName: string; minPrice: number; maxPrice: number; totalStock: number; variantCount: number; isActive: boolean; isFeatured: boolean; imageUrl?: string | null; updatedAt: string }
export interface AdminProduct { id: number; name: string; slug: string; brandId: number; categoryId: number; shortDescription: string; description: string; specs: Record<string, string>; isActive: boolean; isFeatured: boolean; variants: Variant[]; images: ProductImage[] }
export interface InventoryRow { variantId: number; sku: string; productName: string; variantName: string; quantity: number; lowStockThreshold: number; isLow: boolean; updatedAt: string }
export interface Coupon { id: number; code: string; description: string; type: 'percent' | 'fixed'; value: number; maxDiscount?: number | null; minOrderAmount: number; startsAt: string; endsAt: string; usageLimit?: number | null; usedCount: number; perUserLimit?: number | null; isActive: boolean; isPublic: boolean }
export interface AdminOrderRow { code: string; status: OrderStatus; paymentMethod: string; paymentStatus: string; total: number; shipName: string; shipPhone: string; customerEmail: string; itemCount: number; createdAt: string }
export interface AdminUser { id: number; email: string; fullName: string; phone?: string | null; role: 'customer' | 'admin'; isActive: boolean; createdAt: string; orderCount: number; totalSpent: number }
export interface AdminReview { id: number; productId: number; productName: string; authorName: string; authorEmail: string; rating: number; title?: string | null; content: string; isApproved: boolean; isVerifiedPurchase: boolean; createdAt: string }
export interface ContactMessage { id: number; name: string; email: string; phone?: string | null; subject: string; message: string; isHandled: boolean; createdAt: string }
export interface AuditLog { id: number; userId?: number | null; userEmail?: string | null; action: string; entity: string; entityId?: string | null; data?: string | null; ip?: string | null; createdAt: string }
export interface Dashboard {
  kpi: { revenue: number; revenuePrev: number; orders: number; ordersPrev: number; newCustomers: number; newCustomersPrev: number; avgOrderValue: number; lowStockCount: number; pendingOrders: number }
  revenueByDay: { date: string; revenue: number; orders: number }[]
  ordersByStatus: { status: OrderStatus; count: number }[]
  topProducts: { productId: number; name: string; quantity: number; revenue: number }[]
  lowStock: InventoryRow[]
  recentOrders: OrderSummary[]
}
