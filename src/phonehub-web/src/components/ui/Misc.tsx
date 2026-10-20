import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Star, X } from 'lucide-react'
import { formatPrice, discountPercent } from '@/lib/format'

export function Rating({ value, count, size = 'sm' }: { value: number; count?: number; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 'size-3.5' : 'size-5'
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Đánh giá ${value.toFixed(1)} trên 5${count !== undefined ? `, ${count} lượt` : ''}`}>
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={`${px} ${i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`} />
        ))}
      </span>
      {count !== undefined && <span className="text-xs text-slate-500">({count})</span>}
    </span>
  )
}

export function Price({ price, compareAt, size = 'md' }: { price: number; compareAt?: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const pct = discountPercent(price, compareAt)
  const main = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-lg' : 'text-base'
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={`${main} font-bold text-sale`}>{formatPrice(price)}</span>
      {pct > 0 && (
        <>
          <span className="text-sm text-slate-400 line-through">{formatPrice(compareAt!)}</span>
          <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-sale">-{pct}%</span>
        </>
      )}
    </div>
  )
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages: (number | '…')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }
  const btn = 'grid size-10 place-items-center rounded-xl text-sm font-medium transition'
  return (
    <nav aria-label="Phân trang" className="mt-8 flex items-center justify-center gap-1.5">
      <button className={`${btn} border border-slate-200 bg-white hover:border-brand-300 disabled:opacity-40`} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước">
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p, i) => p === '…'
        ? <span key={`e${i}`} className="px-1 text-slate-400">…</span>
        : (
          <button key={p} onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}
            className={`${btn} ${p === page ? 'bg-brand-600 text-white shadow-sm' : 'border border-slate-200 bg-white hover:border-brand-300'}`}>
            {p}
          </button>
        ))}
      <button className={`${btn} border border-slate-200 bg-white hover:border-brand-300 disabled:opacity-40`} disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Trang sau">
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}

/** Hộp thoại có focus trap tối giản, đóng bằng Esc / click nền. */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-3xl ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-slate-100" aria-label="Đóng"><X className="size-5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

/** SEO cơ bản: React 19 tự đưa <title>/<meta> lên <head>. */
export function Seo({ title, description, image }: { title: string; description?: string; image?: string }) {
  const full = title.includes('PhoneHub') ? title : `${title} | PhoneHub`
  return (
    <>
      <title>{full}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={full} />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
    </>
  )
}
