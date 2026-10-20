import { Link, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { OrderStatus, OrderSummary, Paged } from '@/lib/types'
import { formatDateTime, formatPrice, ORDER_STATUS } from '@/lib/format'
import { ButtonLink } from '@/components/ui/Button'
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Pagination, Seo } from '@/components/ui/Misc'

const TABS: (OrderStatus | '')[] = ['', 'AwaitingPayment', 'Pending', 'Confirmed', 'Shipping', 'Delivered', 'Cancelled']

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  return <Badge className={s.tone}>{s.label}</Badge>
}

export default function OrdersPage() {
  const [sp, setSp] = useSearchParams()
  const status = sp.get('status') ?? ''
  const page = Number(sp.get('page')) || 1
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['orders', status, page],
    queryFn: () => api.get<Paged<OrderSummary>>('/api/orders', { status, page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="card p-4 sm:p-6">
      <Seo title="Đơn hàng của tôi" />
      <h1 className="mb-4 text-xl font-bold">Đơn hàng của tôi</h1>
      <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Lọc theo trạng thái">
        {TABS.map(t => (
          <button key={t || 'all'} role="tab" aria-selected={status === t} className="chip shrink-0" aria-pressed={status === t}
            onClick={() => setSp(t ? { status: t } : {})}>
            {t ? ORDER_STATUS[t].label : 'Tất cả'}
          </button>
        ))}
      </div>
      {isError ? <ErrorState error={error} onRetry={() => refetch()} />
        : isLoading ? <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
          : data!.items.length === 0 ? (
            <EmptyState icon={<Package className="size-8" />} title="Chưa có đơn hàng" description={status ? 'Không có đơn ở trạng thái này.' : 'Bạn chưa đặt đơn hàng nào.'} action={<ButtonLink to="/dien-thoai">Mua sắm ngay</ButtonLink>} />
          ) : (
            <>
              <ul className="space-y-3">
                {data!.items.map(o => (
                  <li key={o.code}>
                    <Link to={`/tai-khoan/don-hang/${o.code}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/30">
                      <img src={assetUrl(o.firstItemImage)} alt="" className="size-16 shrink-0 rounded-xl bg-slate-50 object-contain" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">#{o.code}</span><StatusBadge status={o.status} /></div>
                        <p className="truncate text-sm text-slate-600">{o.firstItemName}{o.itemCount > 1 ? ` và ${o.itemCount - 1} sản phẩm khác` : ''}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(o.createdAt)}</p>
                      </div>
                      <p className="shrink-0 font-bold text-sale">{formatPrice(o.total)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination page={data!.page} totalPages={data!.totalPages} onChange={p => setSp({ ...(status ? { status } : {}), page: String(p) })} />
            </>
          )}
    </div>
  )
}
