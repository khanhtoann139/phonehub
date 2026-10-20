import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Cart } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { errorMessage, useCart } from '@/lib/hooks'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Seo } from '@/components/ui/Misc'

export default function CartPage() {
  const { status } = useAuth()
  const { data: cart, isLoading, isError, error, refetch } = useCart()
  const qc = useQueryClient()
  const onSuccess = (c: Cart) => qc.setQueryData(['cart'], c)
  const onError = (e: unknown) => toast.error(errorMessage(e))
  const update = useMutation({ mutationFn: (v: { variantId: number; quantity: number }) => api.put<Cart>(`/api/cart/items/${v.variantId}`, { quantity: v.quantity }), onSuccess, onError })
  const remove = useMutation({ mutationFn: (variantId: number) => api.del<Cart>(`/api/cart/items/${variantId}`), onSuccess: (c: Cart) => { onSuccess(c); toast.success('Đã xóa khỏi giỏ hàng') }, onError })

  if (status === 'anonymous')
    return (
      <div className="container-page py-10">
        <Seo title="Giỏ hàng" />
        <EmptyState className="card" icon={<ShoppingCart className="size-8" />} title="Đăng nhập để xem giỏ hàng" description="Giỏ hàng được lưu theo tài khoản để bạn mua sắm trên mọi thiết bị." action={<ButtonLink to="/dang-nhap?next=/gio-hang">Đăng nhập</ButtonLink>} />
      </div>
    )

  return (
    <div className="container-page py-8">
      <Seo title="Giỏ hàng" />
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Giỏ hàng {cart && cart.itemCount > 0 && <span className="text-lg font-medium text-slate-500">({cart.itemCount} sản phẩm)</span>}</h1>
      {isError ? <ErrorState className="card" error={error} onRetry={() => refetch()} />
        : isLoading || status === 'loading' || !cart ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /></div>
        ) : cart.items.length === 0 ? (
          <EmptyState className="card" icon={<ShoppingCart className="size-8" />} title="Giỏ hàng đang trống" description="Khám phá các mẫu điện thoại mới nhất với giá tốt." action={<ButtonLink to="/dien-thoai">Mua sắm ngay</ButtonLink>} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <ul className="card divide-y divide-slate-100">
              {cart.items.map(item => {
                const busy = (update.isPending && update.variables?.variantId === item.variantId) || (remove.isPending && remove.variables === item.variantId)
                return (
                  <li key={item.variantId} className={`flex gap-4 p-4 sm:p-5 ${busy ? 'opacity-60' : ''}`}>
                    <Link to={`/san-pham/${item.productSlug}`} className="shrink-0">
                      <img src={assetUrl(item.imageUrl)} alt={item.productName} width={88} height={104} className="h-26 w-22 rounded-xl bg-slate-50 object-contain p-1" loading="lazy" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/san-pham/${item.productSlug}`} className="font-semibold hover:text-brand-700">{item.productName}</Link>
                      <p className="text-sm text-slate-500">{item.variantName}</p>
                      <p className="mt-1 font-bold text-sale">{formatPrice(item.unitPrice)}
                        {item.compareAtPrice && item.compareAtPrice > item.unitPrice && <span className="ml-2 text-xs font-normal text-slate-400 line-through">{formatPrice(item.compareAtPrice)}</span>}
                      </p>
                      {item.issue && <p className="mt-1 flex items-center gap-1 text-sm text-rose-600" role="alert"><AlertCircle className="size-4" />{item.issue}</p>}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-xl border border-slate-300" role="group" aria-label={`Số lượng ${item.productName}`}>
                          <button className="grid size-9 place-items-center disabled:opacity-40" disabled={busy || item.quantity <= 1} onClick={() => update.mutate({ variantId: item.variantId, quantity: item.quantity - 1 })} aria-label="Giảm"><Minus className="size-4" /></button>
                          <span className="w-9 text-center text-sm font-semibold">{item.quantity}</span>
                          <button className="grid size-9 place-items-center disabled:opacity-40" disabled={busy || item.quantity >= Math.min(5, item.stock)} onClick={() => update.mutate({ variantId: item.variantId, quantity: item.quantity + 1 })} aria-label="Tăng"><Plus className="size-4" /></button>
                        </div>
                        <button onClick={() => remove.mutate(item.variantId)} disabled={busy} className="flex items-center gap-1 text-sm text-slate-500 hover:text-rose-600" aria-label={`Xóa ${item.productName}`}>
                          <Trash2 className="size-4" /><span className="hidden sm:inline">Xóa</span>
                        </button>
                      </div>
                    </div>
                    <p className="hidden w-32 text-right font-bold sm:block">{formatPrice(item.lineTotal)}</p>
                  </li>
                )
              })}
            </ul>
            <aside className="card h-fit p-5 lg:sticky lg:top-36">
              <h2 className="mb-4 text-lg font-semibold">Tóm tắt đơn hàng</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Tạm tính</dt><dd>{formatPrice(cart.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Phí giao hàng</dt><dd>{cart.shippingFee ? formatPrice(cart.shippingFee) : 'Miễn phí'}</dd></div>
                <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-bold"><dt>Tổng cộng</dt><dd className="text-sale">{formatPrice(cart.total)}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-slate-500">Mã giảm giá được áp dụng ở bước thanh toán. Giá được xác nhận lại tại máy chủ khi đặt hàng.</p>
              {cart.hasIssues
                ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Vui lòng điều chỉnh các sản phẩm có cảnh báo trước khi thanh toán.</p>
                : <ButtonLink to="/thanh-toan" size="lg" className="mt-5 w-full">Tiến hành thanh toán</ButtonLink>}
              <Link to="/dien-thoai" className="mt-3 block text-center text-sm text-brand-700 hover:underline">Tiếp tục mua sắm</Link>
            </aside>
          </div>
        )}
    </div>
  )
}
