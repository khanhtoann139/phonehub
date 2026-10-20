import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { Spinner } from '@/components/ui/Feedback'
import Layout from '@/components/layout/Layout'
import HomePage from '@/pages/HomePage'

const ProductListPage = lazy(() => import('@/pages/ProductListPage'))
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'))
const ComparePage = lazy(() => import('@/pages/ComparePage'))
const WishlistPage = lazy(() => import('@/pages/WishlistPage'))
const CartPage = lazy(() => import('@/pages/CartPage'))
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'))
const PaymentResultPage = lazy(() => import('@/pages/PaymentResultPage'))
const AuthPage = lazy(() => import('@/pages/AuthPage'))
const AccountLayout = lazy(() => import('@/pages/account/AccountLayout'))
const ProfilePage = lazy(() => import('@/pages/account/ProfilePage'))
const OrdersPage = lazy(() => import('@/pages/account/OrdersPage'))
const OrderDetailPage = lazy(() => import('@/pages/account/OrderDetailPage'))
const AddressesPage = lazy(() => import('@/pages/account/AddressesPage'))
const PasswordPage = lazy(() => import('@/pages/account/PasswordPage'))
const PromotionsPage = lazy(() => import('@/pages/PromotionsPage'))
const ContactPage = lazy(() => import('@/pages/ContactPage'))
const PolicyPage = lazy(() => import('@/pages/PolicyPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const AdminLayout = lazy(() => import('@/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('@/admin/DashboardPage'))
const AdminProducts = lazy(() => import('@/admin/ProductsPage'))
const AdminProductEdit = lazy(() => import('@/admin/ProductEditPage'))
const AdminBrands = lazy(() => import('@/admin/BrandsPage'))
const AdminCategories = lazy(() => import('@/admin/CategoriesPage'))
const AdminInventory = lazy(() => import('@/admin/InventoryPage'))
const AdminOrders = lazy(() => import('@/admin/OrdersPage'))
const AdminOrderDetail = lazy(() => import('@/admin/OrderDetailPage'))
const AdminCoupons = lazy(() => import('@/admin/CouponsPage'))
const AdminUsers = lazy(() => import('@/admin/UsersPage'))
const AdminReviews = lazy(() => import('@/admin/ReviewsPage'))
const AdminContacts = lazy(() => import('@/admin/ContactsPage'))
const AdminAuditLogs = lazy(() => import('@/admin/AuditLogsPage'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Spinner className="min-h-[60vh]" />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="dien-thoai" element={<ProductListPage />} />
            <Route path="danh-muc/:category" element={<ProductListPage />} />
            <Route path="thuong-hieu/:brand" element={<ProductListPage />} />
            <Route path="tim-kiem" element={<ProductListPage />} />
            <Route path="san-pham/:slug" element={<ProductDetailPage />} />
            <Route path="so-sanh" element={<ComparePage />} />
            <Route path="yeu-thich" element={<WishlistPage />} />
            <Route path="gio-hang" element={<CartPage />} />
            <Route path="thanh-toan" element={<CheckoutPage />} />
            <Route path="payment/result" element={<PaymentResultPage />} />
            <Route path="dang-nhap" element={<AuthPage key="login" mode="login" />} />
            <Route path="dang-ky" element={<AuthPage key="register" mode="register" />} />
            <Route path="tai-khoan" element={<AccountLayout />}>
              <Route index element={<ProfilePage />} />
              <Route path="don-hang" element={<OrdersPage />} />
              <Route path="don-hang/:code" element={<OrderDetailPage />} />
              <Route path="dia-chi" element={<AddressesPage />} />
              <Route path="mat-khau" element={<PasswordPage />} />
            </Route>
            <Route path="khuyen-mai" element={<PromotionsPage />} />
            <Route path="lien-he" element={<ContactPage />} />
            <Route path="chinh-sach/:slug" element={<PolicyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="san-pham" element={<AdminProducts />} />
            <Route path="san-pham/moi" element={<AdminProductEdit />} />
            <Route path="san-pham/:id" element={<AdminProductEdit />} />
            <Route path="thuong-hieu" element={<AdminBrands />} />
            <Route path="danh-muc" element={<AdminCategories />} />
            <Route path="ton-kho" element={<AdminInventory />} />
            <Route path="don-hang" element={<AdminOrders />} />
            <Route path="don-hang/:code" element={<AdminOrderDetail />} />
            <Route path="ma-giam-gia" element={<AdminCoupons />} />
            <Route path="nguoi-dung" element={<AdminUsers />} />
            <Route path="danh-gia" element={<AdminReviews />} />
            <Route path="lien-he" element={<AdminContacts />} />
            <Route path="nhat-ky" element={<AdminAuditLogs />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
