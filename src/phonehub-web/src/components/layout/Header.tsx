import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Heart, LayoutDashboard, LogOut, Menu, Package, Search, ShoppingCart, Smartphone, User, X } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useCart, useDebounce, useWishlistIds } from '@/lib/hooks'
import { formatPrice } from '@/lib/format'
import type { Brand, Category, ProductCard } from '@/lib/types'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="PhoneHub — Trang chủ">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/30">
        <Smartphone className="size-5" aria-hidden />
      </span>
      <span className={`text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
        Phone<span className="text-brand-600">Hub</span>
      </span>
    </Link>
  )
}

function SearchBox({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const debounced = useDebounce(q.trim(), 300)
  const listId = useId()
  const box = useRef<HTMLDivElement>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['suggest', debounced],
    queryFn: ({ signal }) => api.get<ProductCard[]>('/api/products/suggest', { q: debounced }, signal),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  })
  const items = debounced.length >= 2 ? data ?? [] : []

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (path: string) => { setOpen(false); setQ(''); onDone?.(); navigate(path) }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (active >= 0 && items[active]) return go(`/san-pham/${items[active].slug}`)
    if (q.trim()) go(`/tim-kiem?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div ref={box} className="relative w-full">
      <form role="search" onSubmit={submit}>
        <label htmlFor={`${listId}-input`} className="sr-only">Tìm kiếm điện thoại</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          id={`${listId}-input`}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); setActive(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, items.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, -1)) }
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Bạn muốn tìm điện thoại nào?"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
        />
      </form>
      {open && debounced.length >= 2 && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
          {isFetching && items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Đang tìm…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Không tìm thấy "{debounced}"</p>
          ) : (
            <ul id={listId} role="listbox">
              {items.map((p, i) => (
                <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => go(`/san-pham/${p.slug}`)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-brand-50 ${i === active ? 'bg-brand-50' : ''}`}>
                    <img src={assetUrl(p.imageUrl)} alt="" width={40} height={48} className="h-12 w-10 object-contain" loading="lazy" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="text-sm font-semibold text-sale">{formatPrice(p.price)}</span>
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => go(`/tim-kiem?q=${encodeURIComponent(debounced)}`)} className="w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50">
                  Xem tất cả kết quả cho "{debounced}"
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function AccountMenu() {
  const { user, status, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (status !== 'authenticated' || !user)
    return (
      <Link to="/dang-nhap" className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
        <User className="size-5" aria-hidden /><span className="hidden lg:inline">Đăng nhập</span>
      </Link>
    )

  const item = 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-slate-50'
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-slate-100">
        <span className="grid size-8 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{user.fullName.charAt(0)}</span>
        <span className="hidden max-w-28 truncate text-sm font-medium lg:inline">{user.fullName.split(' ').pop()}</span>
        <ChevronDown className="hidden size-4 text-slate-400 lg:block" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-pop">
          <p className="truncate px-3 py-2 text-xs text-slate-500">{user.email}</p>
          {user.role === 'admin' && <Link role="menuitem" to="/admin" className={`${item} font-medium text-brand-700`}><LayoutDashboard className="size-4" />Trang quản trị</Link>}
          <Link role="menuitem" to="/tai-khoan" className={item}><User className="size-4" />Tài khoản</Link>
          <Link role="menuitem" to="/tai-khoan/don-hang" className={item}><Package className="size-4" />Đơn hàng của tôi</Link>
          <Link role="menuitem" to="/yeu-thich" className={item}><Heart className="size-4" />Yêu thích</Link>
          <button role="menuitem" onClick={() => logout()} className={`${item} w-full text-rose-600`}><LogOut className="size-4" />Đăng xuất</button>
        </div>
      )}
    </div>
  )
}

function CountBadge({ n }: { n: number }) {
  if (!n) return null
  return <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-sale px-1 text-[11px] font-bold leading-5 text-white">{n > 99 ? '99+' : n}</span>
}

export default function Header() {
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setMenu(false), [pathname])
  const cart = useCart().data
  const wish = useWishlistIds().data
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/api/categories'), staleTime: 300_000 })
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => api.get<Brand[]>('/api/brands'), staleTime: 300_000 })

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'}`

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-lg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Bỏ qua tới nội dung</a>
      <div className="hidden bg-gradient-to-r from-brand-700 via-brand-600 to-brand-700 text-white sm:block">
        <p className="container-page py-1.5 text-center text-xs font-medium">
          Miễn phí giao hàng cho đơn từ 2 triệu · Nhập <b>WELCOME10</b> giảm 10% đơn đầu tiên · <Link to="/khuyen-mai" className="underline underline-offset-2">Xem ưu đãi</Link>
        </p>
      </div>
      <div className="container-page flex h-16 items-center gap-3 lg:gap-6">
        <button className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-slate-100 lg:hidden" onClick={() => setMenu(true)} aria-label="Mở menu">
          <Menu className="size-5" />
        </button>
        <Logo />
        <div className="hidden flex-1 md:block"><SearchBox /></div>
        <nav aria-label="Tiện ích" className="ml-auto flex items-center gap-1">
          <Link to="/yeu-thich" className="relative grid size-10 place-items-center rounded-full hover:bg-slate-100" aria-label="Sản phẩm yêu thích">
            <Heart className="size-5" /><CountBadge n={wish?.length ?? 0} />
          </Link>
          <Link to="/gio-hang" className="relative grid size-10 place-items-center rounded-full hover:bg-slate-100" aria-label={`Giỏ hàng (${cart?.itemCount ?? 0} sản phẩm)`}>
            <ShoppingCart className="size-5" /><CountBadge n={cart?.itemCount ?? 0} />
          </Link>
          <AccountMenu />
        </nav>
      </div>
      <div className="container-page pb-3 md:hidden"><SearchBox /></div>
      <nav aria-label="Danh mục" className="hidden border-t border-slate-100 lg:block">
        <div className="container-page flex items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
          <NavLink to="/dien-thoai" end className={navCls}>Tất cả điện thoại</NavLink>
          {categories?.map(c => <NavLink key={c.id} to={`/danh-muc/${c.slug}`} className={navCls}>{c.name}</NavLink>)}
          <span className="mx-2 h-5 w-px bg-slate-200" aria-hidden />
          {brands?.slice(0, 6).map(b => <NavLink key={b.id} to={`/thuong-hieu/${b.slug}`} className={navCls}>{b.name}</NavLink>)}
          <NavLink to="/khuyen-mai" className={({ isActive }) => `${navCls({ isActive })} ml-auto !text-sale`}>🔥 Khuyến mãi</NavLink>
        </div>
      </nav>

      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-white p-5 shadow-pop">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button onClick={() => setMenu(false)} className="grid size-9 place-items-center rounded-full hover:bg-slate-100" aria-label="Đóng menu"><X className="size-5" /></button>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Danh mục</p>
            <div className="mb-6 flex flex-col gap-1">
              <NavLink to="/dien-thoai" end className={navCls}>Tất cả điện thoại</NavLink>
              {categories?.map(c => <NavLink key={c.id} to={`/danh-muc/${c.slug}`} className={navCls}>{c.name}</NavLink>)}
              <NavLink to="/khuyen-mai" className={navCls}>Khuyến mãi</NavLink>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Thương hiệu</p>
            <div className="mb-6 flex flex-wrap gap-2">
              {brands?.map(b => <Link key={b.id} to={`/thuong-hieu/${b.slug}`} className="chip">{b.name}</Link>)}
            </div>
            <div className="mt-auto flex flex-col gap-1 border-t border-slate-100 pt-4 text-sm">
              <Link to="/so-sanh" className="rounded-lg px-3 py-2 hover:bg-slate-50">So sánh sản phẩm</Link>
              <Link to="/lien-he" className="rounded-lg px-3 py-2 hover:bg-slate-50">Liên hệ</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
