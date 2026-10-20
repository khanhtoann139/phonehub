import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { KeyRound, LogOut, MapPin, Package, User } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Spinner } from '@/components/ui/Feedback'

const links = [
  { to: '/tai-khoan', label: 'Thông tin cá nhân', icon: User, end: true },
  { to: '/tai-khoan/don-hang', label: 'Đơn hàng của tôi', icon: Package },
  { to: '/tai-khoan/dia-chi', label: 'Sổ địa chỉ', icon: MapPin },
  { to: '/tai-khoan/mat-khau', label: 'Đổi mật khẩu', icon: KeyRound },
]

export default function AccountLayout() {
  const { status, user, logout } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <Spinner className="min-h-[50vh]" />
  if (status === 'anonymous' || !user) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />

  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[260px_1fr]">
      <aside className="card h-fit p-4">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="grid size-12 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">{user.fullName.charAt(0)}</span>
          <div className="min-w-0"><p className="truncate font-semibold">{user.fullName}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
        </div>
        <nav aria-label="Tài khoản" className="flex gap-1 overflow-x-auto lg:flex-col">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <l.icon className="size-4.5" aria-hidden />{l.label}
            </NavLink>
          ))}
          <button onClick={() => logout()} className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
            <LogOut className="size-4.5" aria-hidden />Đăng xuất
          </button>
        </nav>
      </aside>
      <section className="min-w-0"><Outlet /></section>
    </div>
  )
}
