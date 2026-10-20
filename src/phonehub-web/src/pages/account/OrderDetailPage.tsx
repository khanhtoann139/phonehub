import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Check, PartyPopper } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { OrderDetail, OrderStatus } from '@/lib/types'
import { formatDateTime, formatPrice, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '@/lib/format'
import { errorMessage } from '@/lib/hooks'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Modal, Seo } from '@/components/ui/Misc'
import { StatusBadge } from './OrdersPage'

const STEPS: OrderStatus[] = ['Pending', 'Confirmed', 'Shipping', 'Delivered']

export default function OrderDetailPage() {
  const { code = '' } = useParams()
  const [sp] = useSearchParams()
  const qc = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const { data: o, isLoading, isError, error, refetch } = useQuery({ queryKey: ['orders', 'detail', code], queryFn: () => api.get<OrderDetail>(`/api/orders/${code}`) })

  const cancel = useMutation({
    mutationFn: () => api.post<OrderDetail>(`/api/orders/${code}/cancel`, { reason: reason || undefined }),
    onSuccess: d => { qc.setQueryData(['orders', 'detail', code], d); qc.invalidateQueries({ queryKey: ['orders'] }); setCancelOpen(false); toast.success('Đã hủy đơn hàng') },
    onError: e => toast.error(errorMessage(e)),
  })
  const pay = useMutation({
    mutationFn: () => api.post<{ paymentUrl: string }>(`/api/orders/${code}/pay`),
    onSuccess: r => window.location.assign(r.paymentUrl),
    onError: e => toast.error(errorMessage(e)),
  })

  if (isError) return <div className="card"><ErrorState error={error} onRetry={() => refetch()} /></div>
  if (isLoading || !o) return <Skeleton className="h-96 rounded-2xl" />

  const stepIdx = STEPS.indexOf(o.status)
  return (
    <div className="space-y-4">
      <Seo title={`Đơn hàng #${o.code}`} />
      {sp.get('moi') && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800" role="status">
          <PartyPopper className="size-6 shrink-0" /> Đặt hàng thành công! PhoneHub sẽ gọi xác nhận trong ít phút.
        </div>
      )}
      <div className="card p-5 sm:p-6">
        <Link to="/tai-khoan/don-hang" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="size-4" />Đơn hàng của tôi</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">Đơn #{o.code} <StatusBadge status={o.status} /></h1>
            <p className="text-sm text-slate-500">Đặt lúc {formatDateTime(o.createdAt)}</p>
          </div>
          <div className="flex gap-2">
            {o.canPay && <Button loading={pay.isPending} onClick={() => pay.mutate()}>Thanh toán ngay</Button>}
            {o.canCancel && <Button variant="outline" onClick={() => setCancelOpen(true)}>Hủy đơn</Button>}
          </div>
        </div>

        {o.status !== 'Cancelled' && o.status !== 'AwaitingPayment' && (
          <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Tiến trình đơn hàng">
            {STEPS.map((s, i) => (
              <li key={s} className="flex flex-col items-center text-center" aria-current={i === stepIdx ? 'step' : undefined}>
                <span className={`grid size-9 place-items-center rounded-full text-sm font-bold ${i <= stepIdx ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {i < stepIdx ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={`mt-1.5 text-xs ${i <= stepIdx ? 'font-semibold text-brand-700' : 'text-slate-400'}`}>{ORDER_STATUS[s].label}</span>
              </li>
            ))}
          </ol>
        )}
        {o.status === 'Cancelled' && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Lý do hủy: {o.cancelReason ?? '—'}</p>}
        {o.status === 'AwaitingPayment' && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Đơn hàng đang chờ thanh toán online. Đơn sẽ tự hủy nếu không thanh toán trong 30 phút.</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card p-5 sm:p-6">
          <h2 className="mb-3 font-semibold">Sản phẩm</h2>
          <ul className="divide-y divide-slate-100">
            {o.items.map(i => (
              <li key={i.sku} className="flex gap-3 py-3">
                <img src={assetUrl(i.imageUrl)} alt="" className="size-16 shrink-0 rounded-xl bg-slate-50 object-contain" loading="lazy" />
                <div className="min-w-0 flex-1 text-sm">
                  <Link to={`/san-pham/${i.productSlug}`} className="font-medium hover:text-brand-700">{i.productName}</Link>
                  <p className="text-slate-500">{i.variantName} · SL {i.quantity}</p>
                  <p className="text-slate-500">{formatPrice(i.unitPrice)}</p>
                </div>
                <p className="font-semibold">{formatPrice(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Tạm tính</dt><dd>{formatPrice(o.subtotal)}</dd></div>
            {o.discountAmount > 0 && <div className="flex justify-between text-emerald-600"><dt>Giảm giá {o.couponCode && `(${o.couponCode})`}</dt><dd>-{formatPrice(o.discountAmount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-slate-500">Phí giao hàng</dt><dd>{o.shippingFee ? formatPrice(o.shippingFee) : 'Miễn phí'}</dd></div>
            <div className="flex justify-between text-base font-bold"><dt>Tổng cộng</dt><dd className="text-sale">{formatPrice(o.total)}</dd></div>
          </dl>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-2 font-semibold">Giao hàng</h2>
            <p className="text-sm font-medium">{o.shipName} · {o.shipPhone}</p>
            <p className="text-sm text-slate-600">{o.shipAddress}</p>
            {o.note && <p className="mt-2 text-sm text-slate-500">Ghi chú: {o.note}</p>}
          </div>
          <div className="card p-5">
            <h2 className="mb-2 font-semibold">Thanh toán</h2>
            <p className="text-sm">{PAYMENT_METHOD[o.paymentMethod] ?? o.paymentMethod} · <span className={o.paymentStatus === 'Paid' ? 'font-semibold text-emerald-600' : ''}>{PAYMENT_STATUS[o.paymentStatus] ?? o.paymentStatus}</span></p>
          </div>
        </div>
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Hủy đơn hàng"
        footer={<><Button variant="ghost" onClick={() => setCancelOpen(false)}>Đóng</Button><Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Xác nhận hủy</Button></>}>
        <p className="mb-3 text-sm text-slate-600">Bạn chắc chắn muốn hủy đơn #{o.code}?</p>
        <Textarea label="Lý do (không bắt buộc)" value={reason} maxLength={255} onChange={e => setReason(e.target.value)} className="min-h-20" />
      </Modal>
    </div>
  )
}
