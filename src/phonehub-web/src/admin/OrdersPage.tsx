import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ShoppingBag } from 'lucide-react'
import { api } from '@/lib/api'
import { formatNumber, formatPrice, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '@/lib/format'
import type { AdminOrderRow, OrderStatus, Paged } from '@/lib/types'
import { Badge, EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Pagination, Seo } from '@/components/ui/Misc'
import { DataTable, fmtDateTime, PAGE_SIZE, PageHeader, SearchBox, Segmented, TableSkeleton, td, th, Toolbar, useListParams } from './shared'

const STATUS_TABS: { value: '' | OrderStatus; label: string }[] = [
  { value: '', label: 'Tất cả' },
  ...(Object.keys(ORDER_STATUS) as OrderStatus[]).map(s => ({ value: s, label: ORDER_STATUS[s].label })),
]

export default function OrdersPage() {
  const { values, page, set, setPage } = useListParams(['q', 'status'] as const)
  const params = { ...values, page, pageSize: PAGE_SIZE }
  const q = useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: () => api.get<Paged<AdminOrderRow>>('/api/admin/orders', params),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <Seo title="Đơn hàng — Quản trị" />
      <PageHeader title="Đơn hàng" description="Theo dõi và xử lý đơn hàng của khách." />

      <div className="mb-4">
        <Segmented label="Lọc theo trạng thái" value={values.status as '' | OrderStatus} onChange={v => set({ status: v })} options={STATUS_TABS} />
      </div>
      <Toolbar>
        <SearchBox value={values.q} onChange={v => set({ q: v })} placeholder="Mã đơn, email, tên hoặc SĐT người nhận…" label="Tìm đơn hàng" />
      </Toolbar>

      {q.isPending ? <TableSkeleton cols={6} /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        : q.data.items.length === 0 ? (
          <div className="card"><EmptyState icon={<ShoppingBag className="size-8" aria-hidden />} title="Không có đơn hàng"
            description={values.q || values.status ? 'Không có đơn nào khớp bộ lọc.' : 'Đơn hàng mới sẽ xuất hiện ở đây.'} /></div>
        ) : (
          <>
            <DataTable head={<>
              <th className={th}>Mã đơn</th><th className={th}>Khách hàng</th><th className={`${th} text-center`}>SL</th><th className={`${th} text-right`}>Tổng tiền</th>
              <th className={th}>Thanh toán</th><th className={th}>Trạng thái</th><th className={th}>Ngày đặt</th>
            </>}>
              {q.data.items.map(o => (
                <tr key={o.code} className={`hover:bg-slate-50/60 ${q.isPlaceholderData ? 'opacity-60' : ''}`}>
                  <td className={td}><Link to={`/admin/don-hang/${o.code}`} className="font-semibold text-brand-700 hover:underline">{o.code}</Link></td>
                  <td className={td}>
                    <p className="font-medium">{o.shipName}</p>
                    <p className="text-xs text-slate-500">{o.shipPhone} · {o.customerEmail}</p>
                  </td>
                  <td className={`${td} text-center`}>{o.itemCount}</td>
                  <td className={`${td} whitespace-nowrap text-right font-semibold`}>{formatPrice(o.total)}</td>
                  <td className={td}>
                    <p>{PAYMENT_METHOD[o.paymentMethod] ?? o.paymentMethod}</p>
                    <p className={`text-xs ${o.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-slate-500'}`}>{PAYMENT_STATUS[o.paymentStatus] ?? o.paymentStatus}</p>
                  </td>
                  <td className={td}><Badge className={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge></td>
                  <td className={`${td} whitespace-nowrap text-slate-500`}>{fmtDateTime(o.createdAt)}</td>
                </tr>
              ))}
            </DataTable>
            <p className="mt-3 text-sm text-slate-500">Tổng cộng {formatNumber(q.data.total)} đơn hàng</p>
            <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} />
          </>
        )}
    </>
  )
}
