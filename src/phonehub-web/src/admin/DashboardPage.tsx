import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, PackageX, Receipt, ShoppingBag, UserPlus, Wallet } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/lib/api'
import { compactPrice, formatNumber, formatPrice, ORDER_STATUS } from '@/lib/format'
import type { Dashboard } from '@/lib/types'
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Seo } from '@/components/ui/Misc'
import { Card, fmtDateTime, PageHeader, Segmented } from './shared'

type Days = '7' | '30' | '90'
const BRAND = '#2557eb'

function change(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : null
  return ((cur - prev) / prev) * 100
}

function Kpi({ label, value, icon, delta, hint, tone = 'brand', to }: {
  label: string; value: string; icon: ReactNode; delta?: number | null; hint?: string; tone?: 'brand' | 'amber' | 'red'; to?: string
}) {
  const tones = { brand: 'bg-brand-50 text-brand-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-rose-50 text-rose-600' }
  const body = (
    <div className="card h-full p-5 transition hover:border-brand-200">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
      {delta !== undefined && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
          {delta === null ? <span className="font-semibold text-emerald-600">Mới</span> : (
            <span className={`inline-flex items-center font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {delta >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
              {Math.abs(delta).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%
            </span>
          )}
          so với kỳ trước
        </p>
      )}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
  return to ? <Link to={to} className="block rounded-2xl">{body}</Link> : body
}

const dayLabel = (s: string) => { const [, m, d] = s.split('-'); return `${d}/${m}` }

export default function DashboardPage() {
  const [days, setDays] = useState<Days>('30')
  const q = useQuery({ queryKey: ['admin', 'dashboard', days], queryFn: () => api.get<Dashboard>('/api/admin/dashboard', { days }) })

  return (
    <>
      <Seo title="Tổng quan — Quản trị" />
      <PageHeader title="Tổng quan" description="Tình hình kinh doanh của cửa hàng."
        actions={<Segmented label="Khoảng thời gian" value={days} onChange={setDays}
          options={[{ value: '7', label: '7 ngày' }, { value: '30', label: '30 ngày' }, { value: '90', label: '90 ngày' }]} />} />

      {q.isPending ? <DashboardSkeleton /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : (
        <DashboardBody data={q.data} />
      )}
    </>
  )
}

function DashboardBody({ data }: { data: Dashboard }) {
  const { kpi } = data
  const statusData = data.ordersByStatus.map(s => ({ label: ORDER_STATUS[s.status]?.label ?? s.status, count: s.count }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Doanh thu" value={formatPrice(kpi.revenue)} icon={<Wallet className="size-5" aria-hidden />} delta={change(kpi.revenue, kpi.revenuePrev)} />
        <Kpi label="Đơn hàng" value={formatNumber(kpi.orders)} icon={<ShoppingBag className="size-5" aria-hidden />} delta={change(kpi.orders, kpi.ordersPrev)} />
        <Kpi label="Khách mới" value={formatNumber(kpi.newCustomers)} icon={<UserPlus className="size-5" aria-hidden />} delta={change(kpi.newCustomers, kpi.newCustomersPrev)} />
        <Kpi label="Giá trị đơn TB" value={formatPrice(kpi.avgOrderValue)} icon={<Receipt className="size-5" aria-hidden />} hint="Không tính đơn hủy / chờ thanh toán" />
        <Kpi label="Đơn chờ xác nhận" value={formatNumber(kpi.pendingOrders)} icon={<Clock className="size-5" aria-hidden />} tone="amber"
          hint="Cần xử lý" to="/admin/don-hang?status=Pending" />
        <Kpi label="Sắp hết hàng" value={formatNumber(kpi.lowStockCount)} icon={<AlertTriangle className="size-5" aria-hidden />} tone="red"
          hint="Biến thể dưới ngưỡng tồn" to="/admin/ton-kho?status=low" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Doanh thu theo ngày" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickFormatter={(v: number) => compactPrice(v)} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={64} />
                <Tooltip formatter={v => [formatPrice(Number(v)), 'Doanh thu']} labelFormatter={l => `Ngày ${dayLabel(String(l))}`}
                  contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 13 }} />
                <Area type="monotone" dataKey="revenue" stroke={BRAND} strokeWidth={2} fill="url(#revFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Đơn hàng theo trạng thái">
          {statusData.length === 0 ? <EmptyState title="Chưa có đơn hàng" className="py-8" /> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={v => [formatNumber(Number(v)), 'Số đơn']} cursor={{ fill: '#eff5ff' }}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 13 }} />
                  <Bar dataKey="count" fill={BRAND} radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Top 5 sản phẩm bán chạy">
          {data.topProducts.length === 0 ? <EmptyState title="Chưa có dữ liệu bán hàng" className="py-8" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr><th className="py-2 pr-3">#</th><th className="py-2 pr-3">Sản phẩm</th><th className="py-2 pr-3 text-right">SL</th><th className="py-2 text-right">Doanh thu</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topProducts.map((p, i) => (
                    <tr key={p.productId}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-400">{i + 1}</td>
                      <td className="py-2.5 pr-3"><Link to={`/admin/san-pham/${p.productId}`} className="font-medium hover:text-brand-700">{p.name}</Link></td>
                      <td className="py-2.5 pr-3 text-right">{formatNumber(p.quantity)}</td>
                      <td className="py-2.5 text-right font-semibold">{formatPrice(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Sắp hết hàng" actions={<Link to="/admin/ton-kho?status=low" className="text-sm font-medium text-brand-600 hover:underline">Xem tất cả</Link>}>
          {data.lowStock.length === 0 ? <EmptyState title="Tồn kho ổn định" description="Không có biến thể nào dưới ngưỡng." className="py-8" /> : (
            <ul className="divide-y divide-slate-100">
              {data.lowStock.map(r => (
                <li key={r.variantId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.productName}</p>
                    <p className="text-xs text-slate-500">{r.variantName} · {r.sku}</p>
                  </div>
                  <Badge className={r.quantity === 0 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}>
                    {r.quantity === 0 ? <><PackageX className="mr-1 size-3.5" aria-hidden />Hết hàng</> : `Còn ${r.quantity}`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Đơn hàng gần đây" actions={<Link to="/admin/don-hang" className="text-sm font-medium text-brand-600 hover:underline">Xem tất cả</Link>}>
        {data.recentOrders.length === 0 ? <EmptyState title="Chưa có đơn hàng" className="py-8" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2 pr-3">Mã đơn</th><th className="py-2 pr-3">Sản phẩm</th><th className="py-2 pr-3">Trạng thái</th><th className="py-2 pr-3 text-right">Tổng tiền</th><th className="py-2 text-right">Thời gian</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentOrders.map(o => (
                  <tr key={o.code}>
                    <td className="py-2.5 pr-3"><Link to={`/admin/don-hang/${o.code}`} className="font-semibold text-brand-700 hover:underline">{o.code}</Link></td>
                    <td className="max-w-56 truncate py-2.5 pr-3 text-slate-600">{o.firstItemName}{o.itemCount > 1 && ` +${o.itemCount - 1}`}</td>
                    <td className="py-2.5 pr-3"><Badge className={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge></td>
                    <td className="py-2.5 pr-3 text-right font-semibold">{formatPrice(o.total)}</td>
                    <td className="whitespace-nowrap py-2.5 text-right text-slate-500">{fmtDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Đang tải">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}
