import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { api, ApiError } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/format'
import { errorMessage, useDebounce } from '@/lib/hooks'
import type { AdminBrand, AdminCategory } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Badge, Skeleton } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Misc'

// ───────────── Kiểu dùng riêng cho trang quản trị ─────────────
/** DELETE có thể trả 204 (xóa hẳn) hoặc 200 {softDeleted,message} (chuyển sang ẩn/tắt). */
export type DeleteResult = { softDeleted?: boolean; message?: string } | undefined

export const PAGE_SIZE = 20

// ───────────── Ngày giờ ─────────────
/** Server trả DateTime đọc từ DB không kèm múi giờ (thực chất là UTC) → thêm 'Z' để trình duyệt hiểu đúng. */
export function utc(s: string) {
  return /(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`
}
export const fmtDateTime = (s: string) => formatDateTime(utc(s))
export const fmtDate = (s: string) => formatDate(utc(s))

/** ISO (UTC) → giá trị cho <input type="datetime-local"> theo giờ máy. */
export function toLocalInput(s?: string | null) {
  if (!s) return ''
  const d = new Date(utc(s))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** Giá trị datetime-local (giờ máy) → ISO UTC gửi server. */
export const fromLocalInput = (v: string) => new Date(v).toISOString()

// ───────────── Tham số danh sách gắn với URL ─────────────
type Patch<K extends string> = Partial<Record<K | 'page', string | number | null | undefined>>

/** Đọc/ghi bộ lọc danh sách trên URL (?q=&status=&page=). Đổi bộ lọc → về trang 1. */
export function useListParams<K extends string>(keys: readonly K[]) {
  const [sp, setSp] = useSearchParams()
  const values = Object.fromEntries(keys.map(k => [k, sp.get(k) ?? ''])) as Record<K, string>
  const page = Math.max(1, Number(sp.get('page')) || 1)

  const set = (patch: Patch<K>) =>
    setSp(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === '' || (k === 'page' && Number(v) <= 1)) next.delete(k)
        else next.set(k, String(v))
      }
      if (!('page' in patch)) next.delete('page')
      return next
    }, { replace: true })

  return { values, page, set, setPage: (p: number) => { set({ page: p } as Patch<K>); window.scrollTo({ top: 0, behavior: 'smooth' }) } }
}

// ───────────── Dữ liệu dùng chung ─────────────
export const useAdminBrands = () => useQuery({ queryKey: ['admin', 'brands'], queryFn: () => api.get<AdminBrand[]>('/api/admin/brands') })
export const useAdminCategories = () => useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api.get<AdminCategory[]>('/api/admin/categories') })

/** Gán lỗi theo trường từ server (vd "variants[0].Sku") vào react-hook-form ("variants.0.sku"). Trả về true nếu gán được ít nhất một lỗi. */
export function applyFieldErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>, known?: (path: string) => boolean) {
  if (!(e instanceof ApiError)) return false
  let applied = false
  for (const [key, messages] of Object.entries(e.fieldErrors)) {
    const path = key.replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1')
      .split('.').filter(Boolean).map(s => s.charAt(0).toLowerCase() + s.slice(1)).join('.')
    if (!path || (known && !known(path))) continue
    setError(path as Path<T>, { type: 'server', message: messages[0] })
    applied = true
  }
  return applied
}

// ───────────── Khối giao diện ─────────────
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Xác nhận', danger, loading, onConfirm, onClose, children }: {
  open: boolean; title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean
  onConfirm: () => void; onClose: () => void; children?: ReactNode
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Hủy</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      {message && <div className="text-sm text-slate-600">{message}</div>}
      {children}
    </Modal>
  )
}

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
  blue: 'bg-brand-50 text-brand-700 ring-brand-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
} as const
export type Tone = keyof typeof TONES

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <Badge className={TONES[tone]}>{children}</Badge>
}

export function ActiveBadge({ active, on = 'Hiển thị', off = 'Đang ẩn' }: { active: boolean; on?: string; off?: string }) {
  return <StatusBadge tone={active ? 'green' : 'gray'}>{active ? on : off}</StatusBadge>
}

/** Khung bảng: card + cuộn ngang trên mobile. */
export function DataTable({ head, children, footer }: { head: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>{head}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}
export const th = 'whitespace-nowrap px-4 py-3'
export const td = 'px-4 py-3 align-middle'

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card space-y-3 p-4" aria-busy="true" aria-label="Đang tải">
      <Skeleton className="h-6 w-1/3" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, j) => <Skeleton key={j} className="h-9" />)}
        </div>
      ))}
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">{children}</div>
}

/** Ô tìm kiếm: gõ cục bộ, đẩy lên URL sau khi ngừng gõ. */
export function SearchBox({ value, onChange, placeholder = 'Tìm kiếm…', label = 'Tìm kiếm' }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  const [text, setText] = useState(value)
  const debounced = useDebounce(text.trim(), 350)
  const last = useRef(value)
  const cb = useRef(onChange)
  cb.current = onChange
  // URL đổi từ bên ngoài (vd bấm lọc nhanh) → đồng bộ lại ô nhập.
  useEffect(() => {
    if (value !== last.current) { last.current = value; setText(value) }
  }, [value])
  useEffect(() => {
    if (debounced !== last.current) { last.current = debounced; cb.current(debounced) }
  }, [debounced])
  return (
    <div className="relative w-full lg:max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input type="search" aria-label={label} placeholder={placeholder} value={text} onChange={e => setText(e.target.value)} className="input pl-10" />
    </div>
  )
}

/** Nhóm nút chọn một (tabs lọc trạng thái / khoảng thời gian). */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${o.value === value ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function IconButton({ label, onClick, children, tone = 'default', disabled }: { label: string; onClick?: () => void; children: ReactNode; tone?: 'default' | 'danger'; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`grid size-9 place-items-center rounded-lg transition disabled:opacity-40 ${tone === 'danger' ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-600 hover:bg-slate-100 hover:text-brand-700'}`}>
      {children}
    </button>
  )
}

/** Nút chọn file ảnh → POST /api/admin/uploads → trả url. */
export function UploadButton({ onUploaded, label = 'Tải ảnh lên' }: { onUploaded: (url: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (file?: File) => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Ảnh tối đa 2MB'); return }
    const form = new FormData()
    form.append('file', file)
    setBusy(true)
    try {
      const res = await api.upload<{ url: string }>('/api/admin/uploads', form)
      onUploaded(res.url)
      toast.success('Đã tải ảnh lên')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden
        onChange={e => pick(e.target.files?.[0])} />
      <Button variant="outline" size="sm" loading={busy} icon={<Upload className="size-4" aria-hidden />} onClick={() => input.current?.click()}>{label}</Button>
    </>
  )
}

export function Card({ title, actions, children, className = '' }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
