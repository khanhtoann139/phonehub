import { Suspense, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router'
import {
  Boxes, FolderTree, History, LayoutDashboard, LogOut, Mail, Menu, ShieldAlert, ShoppingBag, Smartphone, Star, Store, Tag,
  TicketPercent, Users, X, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, Spinner } from '@/components/ui/Feedback'

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/don-hang', label: 'Đơn hàng', icon: ShoppingBag },
  { to: '/admin/san-pham', label: 'Sản phẩm', icon: Smartphone },
  { to: '/admin/thuong-hieu', label: 'Thương hiệu', icon: Tag },
  { to: '/admin/danh-muc', label: 'Danh mục', icon: FolderTree },
  { to: '/admin/ton-kho', label: 'Tồn kho', icon: Boxes },
  { to: '/admin/ma-giam-gia', label: 'Mã giảm giá', icon: TicketPercent },
  { to: '/admin/nguoi-dung', label: 'Người dùng', icon: Users },
  { to: '/admin/danh-gia', label: 'Đánh giá', icon: Star },
  { to: '/admin/lien-he', label: 'Liên hệ', icon: Mail },
  { to: '/admin/nhat-ky', label: 'Nhật ký', icon: History },
]

function Logo() {
  return (
    <Link to="/admin" className="flex items-center gap-2.5 font-bold text-ink">
      <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
        <Smartphone className="size-5" aria-hidden />
      </span>
      <span>PhoneHub <span className="font-semibold text-brand-600">Admin</span></span>
    </Link>
  )
}

export default function AdminLayout() {
  const { user, status, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => { setOpen(false) }, [pathname])

  if (status === 'loading') return <Spinner className="min-h-screen" label="Đang kiểm tra phiên đăng nhập…" />
  if (status !== 'authenticated' || !user) return <Navigate to="/dang-nhap?next=/admin" replace />
  if (user.role !== 'admin') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
        <EmptyState icon={<ShieldAlert className="size-8" aria-hidden />} title="403 — Không có quyền truy cập"
          description="Khu vực quản trị chỉ dành cho tài khoản quản trị viên."
          action={<ButtonLink to="/">Về trang chủ</ButtonLink>} />
      </div>
    )
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
        <Logo />
        <button type="button" className="grid size-9 place-items-center rounded-lg hover:bg-slate-100 lg:hidden" aria-label="Đóng menu" onClick={() => setOpen(false)}>
          <X className="size-5" />
        </button>
      </div>
      <nav aria-label="Quản trị" className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-ink'}`}>
            {({ isActive }) => <><Icon className={`size-[18px] ${isActive ? 'text-brand-600' : 'text-slate-400'}`} aria-hidden />{label}</>}
          </NavLink>
        ))}
        <div className="my-3 border-t border-slate-100" />
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-ink">
          <Store className="size-[18px] text-slate-400" aria-hidden /> Về cửa hàng
        </Link>
      </nav>
      <div className="flex items-center gap-3 border-t border-slate-100 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700" aria-hidden>
          {user.fullName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
        <button type="button" onClick={() => void logout()} aria-label="Đăng xuất" title="Đăng xuất"
          className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600">
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-pop">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button type="button" className="grid size-9 place-items-center rounded-lg hover:bg-slate-100" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </button>
          <Logo />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<Spinner />}><Outlet /></Suspense>
        </main>
      </div>
    </div>
  )
}
