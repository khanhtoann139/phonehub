import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, CheckCircle2, CircleCheckBig, Clock, Truck, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api, assetUrl } from '@/lib/api'
import { formatPrice, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '@/lib/format'
import { errorMessage } from '@/lib/hooks'
import type { OrderDetail, OrderStatus } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Badge, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Textarea } from '@/components/ui/Field'
import { Seo } from '@/components/ui/Misc'
import { Card, ConfirmDialog, fmtDateTime, PageHeader } from './shared'

const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  AwaitingPayment: ['Pending', 'Cancelled'],
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Shipping', 'Cancelled'],
  Shipping: ['Delivered'],
}

const ACTION: Record<OrderStatus, { label: string; icon: LucideIcon; confirm: string }> = {
  AwaitingPayment: { label: 'Chờ thanh toán', icon: Clock, confirm: '' },
  Pending: { label: 'Chuyển sang chờ xác nhận', icon: Clock, confirm: 'Chuyển đơn sang trạng thái chờ xác nhận (bỏ qua bước chờ thanh toán)?' },
  Confirmed: { label: 'Xác nhận đơn', icon: CheckCircle2, confirm: 'Xác nhận đơn hàng này và chuẩn bị giao?' },
  Shipping: { label: 'Bắt đầu giao hàng', icon: Truck, confirm: 'Đánh dấu đơn hàng đã được bàn giao cho đơn vị vận chuyển?' },
  Delivered: { label: 'Đã giao thành công', icon: CircleCheckBig, confirm: 'Xác nhận khách đã nhận hàng?' },
  Cancelled: { label: 'Hủy đơn', icon: Ban, confirm: 'Hủy đơn hàng này? Tồn kho sẽ được hoàn lại.' },
}

export default function OrderDetailPage() {
  const { code = '' } = useParams()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['admin', 'order', code], queryFn: () => api.get<OrderDetail>(`/api/admin/orders/${encodeURIComponent(code)}`) })
  const [target, setTarget] = useState<OrderStatus | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  const update = useMutation({
    mutationFn: (v: { status: OrderStatus; reason?: string }) => api.put<OrderDetail>(`/api/admin/orders/${encodeURIComponent(code)}/status`, v),
    onSuccess: o => {
      qc.setQueryData(['admin', 'order', code], o)
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      toast.success(`Đơn hàng chuyển sang “${ORDER_STATUS[o.status].label}”`)
      setTarget(null)
    },
    onError: e => toast.error(errorMessage(e)),
  })

  const open = (s: OrderStatus) => { setTarget(s); setReason(''); setReasonError('') }
  const confirm = () => {
    if (!target) return
    if (target === 'Cancelled') {
      const r = reason.trim()
      if (!r) { setReasonError('Vui lòng nhập lý do hủy'); return }
      if (r.length > 255) { setReasonError('Tối đa 255 ký tự'); return }
      update.mutate({ status: target, reason: r })
    } else update.mutate({ status: target })
  }

  const back = (
    <Link to="/admin/don-hang" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-700">
      <ArrowLeft className="size-4" aria-hidden /> Danh sách đơn hàng
    </Link>
  )

  if (q.isPending) return <>{back}<Skeleton className="mb-6 h-10 w-64" /><div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-96 rounded-2xl lg:col-span-2" /><Skeleton className="h-96 rounded-2xl" /></div></>
  if (q.isError) return <>{back}<div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div></>

  const o = q.data
  const next = NEXT[o.status] ?? []

  return (
    <>
      <Seo title={`Đơn ${o.code} — Quản trị`} />
      {back}
      <PageHeader title={`Đơn hàng ${o.code}`} description={`Đặt lúc ${fmtDateTime(o.createdAt)} · Cập nhật ${fmtDateTime(o.updatedAt)}`}
        actions={next.map(s => {
          const A = ACTION[s]
          return <Button key={s} variant={s === 'Cancelled' ? 'outline' : 'primary'} className={s === 'Cancelled' ? 'text-rose-600 hover:border-rose-300 hover:text-rose-700' : ''}
            icon={<A.icon className="size-4" aria-hidden />} onClick={() => open(s)}>{A.label}</Button>
        })} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge className={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
        <Badge className={o.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}>
          {PAYMENT_STATUS[o.paymentStatus] ?? o.paymentStatus}
        </Badge>
        {o.cancelReason && <span className="text-sm text-rose-600">Lý do hủy: {o.cancelReason}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Sản phẩm (${o.items.length})`}>
            <ul className="divide-y divide-slate-100">
              {o.items.map((it, i) => (
                <li key={`${it.variantId ?? it.productId}-${i}`} className="flex gap-4 py-3">
                  <img src={assetUrl(it.imageUrl)} alt="" className="size-16 shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-1" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/san-pham/${it.productId}`} className="font-medium hover:text-brand-700">{it.productName}</Link>
                    <p className="text-xs text-slate-500">{it.variantName} · SKU {it.sku}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatPrice(it.unitPrice)} × {it.quantity}</p>
                  </div>
                  <p className="font-semibold whitespace-nowrap">{formatPrice(it.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Tạm tính</dt><dd>{formatPrice(o.subtotal)}</dd></div>
              {o.discountAmount > 0 && (
                <div className="flex justify-between"><dt className="text-slate-500">Giảm giá{o.couponCode && <> (<span className="font-mono">{o.couponCode}</span>)</>}</dt><dd className="text-emerald-600">−{formatPrice(o.discountAmount)}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-slate-500">Phí vận chuyển</dt><dd>{o.shippingFee === 0 ? 'Miễn phí' : formatPrice(o.shippingFee)}</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold"><dt>Tổng cộng</dt><dd className="text-brand-700">{formatPrice(o.total)}</dd></div>
            </dl>
          </Card>

          <Card title="Thanh toán">
            <p className="mb-3 text-sm">Phương thức: <strong>{PAYMENT_METHOD[o.paymentMethod] ?? o.paymentMethod}</strong></p>
            {o.payments.length === 0 ? <p className="text-sm text-slate-500">Chưa có giao dịch thanh toán.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr><th className="py-2 pr-3">Cổng</th><th className="py-2 pr-3">Mã giao dịch</th><th className="py-2 pr-3 text-right">Số tiền</th><th className="py-2 pr-3">Trạng thái</th><th className="py-2">Thời gian</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {o.payments.map(p => (
                      <tr key={p.txnRef}>
                        <td className="py-2 pr-3">{PAYMENT_METHOD[p.provider] ?? p.provider}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{p.txnRef}</td>
                        <td className="py-2 pr-3 text-right">{formatPrice(p.amount)}</td>
                        <td className="py-2 pr-3">{PAYMENT_STATUS[p.status] ?? p.status}</td>
                        <td className="py-2 text-xs text-slate-500">{fmtDateTime(p.createdAt)}{p.paidAt && <><br />Trả lúc {fmtDateTime(p.paidAt)}</>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Khách hàng">
            <p className="font-medium">{o.customerName ?? '—'}</p>
            {o.customerEmail && <a href={`mailto:${o.customerEmail}`} className="text-sm text-brand-700 hover:underline">{o.customerEmail}</a>}
          </Card>
          <Card title="Giao hàng">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-slate-500">Người nhận</dt><dd className="font-medium">{o.shipName}</dd></div>
              <div><dt className="text-slate-500">Số điện thoại</dt><dd><a href={`tel:${o.shipPhone}`} className="hover:text-brand-700">{o.shipPhone}</a></dd></div>
              <div><dt className="text-slate-500">Địa chỉ</dt><dd>{o.shipAddress}</dd></div>
              {o.note && <div><dt className="text-slate-500">Ghi chú</dt><dd className="whitespace-pre-line">{o.note}</dd></div>}
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} title={target ? ACTION[target].label : ''}
        message={target ? ACTION[target].confirm : ''} danger={target === 'Cancelled'} loading={update.isPending}
        confirmLabel={target === 'Cancelled' ? 'Hủy đơn' : 'Xác nhận'} onConfirm={confirm}>
        {target === 'Cancelled' && (
          <Textarea label="Lý do hủy" required rows={3} maxLength={255} className="min-h-0" wrapperClassName="mt-4" value={reason}
            onChange={e => { setReason(e.target.value); setReasonError('') }} error={reasonError} placeholder="Ví dụ: khách yêu cầu hủy, hết hàng…" />
        )}
      </ConfirmDialog>
    </>
  )
}
