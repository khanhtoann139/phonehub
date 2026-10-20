import { Link, Outlet, useLocation } from 'react-router'
import { Headphones, RotateCcw, ShieldCheck, Truck, X } from 'lucide-react'
import Header, { Logo } from './Header'
import { useCompare } from '@/lib/hooks'
import { assetUrl } from '@/lib/api'
import { ButtonLink } from '@/components/ui/Button'

function CompareBar() {
  const { list, remove, clear } = useCompare()
  const { pathname } = useLocation()
  if (list.length === 0 || pathname === '/so-sanh') return null
  return (
    <aside aria-label="Sản phẩm đang so sánh" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-pop backdrop-blur">
      <div className="container-page flex items-center gap-3 py-3">
        <div className="flex flex-1 gap-2 overflow-x-auto">
          {list.map(p => (
            <div key={p.id} className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 py-1 pl-1 pr-2">
              <img src={assetUrl(p.imageUrl)} alt="" className="size-9 object-contain" />
              <span className="max-w-32 truncate text-xs font-medium">{p.name}</span>
              <button onClick={() => remove(p.id)} aria-label={`Bỏ ${p.name} khỏi so sánh`} className="text-slate-400 hover:text-rose-600"><X className="size-4" /></button>
            </div>
          ))}
        </div>
        <button onClick={clear} className="hidden text-sm text-slate-500 hover:text-slate-800 sm:block">Xóa hết</button>
        <ButtonLink to="/so-sanh" size="sm">So sánh ({list.length})</ButtonLink>
      </div>
    </aside>
  )
}

function Footer() {
  const col = 'mb-3 text-sm font-semibold text-white'
  const link = 'block py-1 text-sm text-slate-400 transition hover:text-white'
  return (
    <footer className="mt-16 bg-ink text-slate-300">
      <div className="border-b border-white/10">
        <div className="container-page grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          {[
            [Truck, 'Giao nhanh 2h', 'Nội thành HCM & Hà Nội'],
            [ShieldCheck, 'Chính hãng 100%', 'Bảo hành 12 tháng'],
            [RotateCcw, '1 đổi 1 trong 30 ngày', 'Nếu lỗi do nhà sản xuất'],
            [Headphones, 'Hỗ trợ 8h–22h', 'Hotline 1800 6868'],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Truck
            return (
              <div key={t as string} className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600/20 text-brand-300"><I className="size-5" aria-hidden /></span>
                <div><p className="text-sm font-semibold text-white">{t as string}</p><p className="text-xs text-slate-400">{d as string}</p></div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm text-slate-400">PhoneHub — hệ thống bán lẻ điện thoại chính hãng. Giá minh bạch, tư vấn tận tâm, giao hàng toàn quốc.</p>
        </div>
        <div>
          <p className={col}>Mua sắm</p>
          <Link to="/dien-thoai" className={link}>Điện thoại</Link>
          <Link to="/khuyen-mai" className={link}>Khuyến mãi</Link>
          <Link to="/so-sanh" className={link}>So sánh</Link>
        </div>
        <div>
          <p className={col}>Chính sách</p>
          <Link to="/chinh-sach/bao-hanh" className={link}>Bảo hành</Link>
          <Link to="/chinh-sach/doi-tra" className={link}>Đổi trả</Link>
          <Link to="/chinh-sach/giao-hang" className={link}>Giao hàng</Link>
          <Link to="/chinh-sach/bao-mat" className={link}>Bảo mật thông tin</Link>
        </div>
        <div>
          <p className={col}>Hỗ trợ</p>
          <Link to="/lien-he" className={link}>Liên hệ</Link>
          <Link to="/tai-khoan/don-hang" className={link}>Tra cứu đơn hàng</Link>
          <p className="py-1 text-sm text-slate-400">cskh@phonehub.local</p>
        </div>
      </div>
      <p className="border-t border-white/10 py-5 text-center text-xs text-slate-500">© {new Date().getFullYear()} PhoneHub. Dự án demo — dữ liệu sản phẩm mang tính minh họa.</p>
    </footer>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CompareBar />
    </div>
  )
}
