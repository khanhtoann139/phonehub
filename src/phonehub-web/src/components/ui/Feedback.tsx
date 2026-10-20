import type { ReactNode } from 'react'
import { AlertTriangle, Loader2, PackageOpen, RefreshCw } from 'lucide-react'
import { Button } from './Button'
import { ApiError } from '@/lib/api'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function Spinner({ label = 'Đang tải…', className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2 py-10 text-sm text-slate-500 ${className}`}>
      <Loader2 className="size-5 animate-spin text-brand-600" aria-hidden /> {label}
    </div>
  )
}

export function EmptyState({ icon, title, description, action, className = '' }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon ?? <PackageOpen className="size-8" aria-hidden />}</div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className = '' }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof ApiError ? error.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.'
  return (
    <div role="alert" className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><AlertTriangle className="size-7" aria-hidden /></div>
      <h3 className="font-semibold text-ink">Không tải được dữ liệu</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-5" icon={<RefreshCw className="size-4" />} onClick={onRetry}>Thử lại</Button>}
    </div>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}>{children}</span>
}
