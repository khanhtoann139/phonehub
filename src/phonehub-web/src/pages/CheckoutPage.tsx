import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CreditCard, Lock, MapPin, Tag, Truck } from 'lucide-react'
import { api, ApiError, assetUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Address, CheckoutPreview, PaymentMethod, PlaceOrderResponse } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { errorMessage } from '@/lib/hooks'
import { addressSchema } from '@/lib/validation'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Checkbox, Input, Textarea } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui/Feedback'
import { Seo } from '@/components/ui/Misc'

const schema = addressSchema.extend({ note: z.string().max(500).optional(), saveToAddressBook: z.boolean() })
type FormValues = z.infer<typeof schema>

export default function CheckoutPage() {
  const { status, user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [addressId, setAddressId] = useState<number | 'new' | null>(null)
  const [method, setMethod] = useState('cod')
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<string | undefined>()

  const enabled = status === 'authenticated'
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api.get<Address[]>('/api/account/addresses'), enabled })
  const methods = useQuery({ queryKey: ['payment-methods'], queryFn: () => api.get<PaymentMethod[]>('/api/payments/methods'), staleTime: 300_000 })
  const preview = useQuery({
    queryKey: ['checkout-preview', coupon],
    queryFn: () => api.post<CheckoutPreview>('/api/checkout/preview', { couponCode: coupon }),
    enabled,
  })

  useEffect(() => {
    if (addressId !== null || !addresses.data) return
    setAddressId(addresses.data.find(a => a.isDefault)?.id ?? addresses.data[0]?.id ?? 'new')
  }, [addresses.data, addressId])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { recipientName: user?.fullName ?? '', phone: user?.phone ?? '', line1: '', ward: '', district: '', province: '', note: '', saveToAddressBook: true },
  })

  const place = useMutation({
    mutationFn: (body: object) => api.post<PlaceOrderResponse>('/api/orders', body),
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ['cart'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      if (res.paymentUrl) { window.location.assign(res.paymentUrl); return }
      toast.success('Đặt hàng thành công!')
      navigate(`/tai-khoan/don-hang/${res.order.code}?moi=1`, { replace: true })
    },
    onError: e => {
      toast.error(errorMessage(e))
      if (e instanceof ApiError && (e.code === 'cart_invalid' || e.code === 'insufficient_stock')) qc.invalidateQueries({ queryKey: ['checkout-preview'] })
    },
  })

  if (status === 'anonymous') return <Navigate to="/dang-nhap?next=/thanh-toan" replace />
  if (status === 'loading') return <Spinner className="min-h-[50vh]" />

  const p = preview.data
  if (preview.isError) return <div className="container-page py-10"><ErrorState className="card" error={preview.error} onRetry={() => preview.refetch()} /></div>
  if (p && p.items.length === 0)
    return <div className="container-page py-10"><EmptyState className="card" title="Giỏ hàng trống" action={<ButtonLink to="/dien-thoai">Mua sắm ngay</ButtonLink>} /></div>

  const submit = form.handleSubmit(
    v => place.mutate({
      paymentMethod: method,
      couponCode: p?.couponApplied ? coupon : undefined,
      note: v.note || undefined,
      ...(addressId === 'new' ? { address: { ...v, ward: v.ward || undefined } } : { addressId }),
    }),
    () => toast.error('Vui lòng kiểm tra lại thông tin giao hàng'),
  )
  const onPlace = () => {
    if (addressId !== 'new' && addressId !== null) {
      // Dùng địa chỉ có sẵn → chỉ cần ghi chú
      place.mutate({ addressId, paymentMethod: method, couponCode: p?.couponApplied ? coupon : undefined, note: form.getValues('note') || undefined })
    } else submit()
  }
  const err = form.formState.errors
  const hasIssues = p?.items.some(i => i.issue)

  return (
    <div className="container-page py-8">
      <Seo title="Thanh toán" />
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Thanh toán</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="ship-h">
            <h2 id="ship-h" className="mb-4 flex items-center gap-2 text-lg font-semibold"><MapPin className="size-5 text-brand-600" />Địa chỉ giao hàng</h2>
            {addresses.isLoading ? <Skeleton className="h-24" /> : (
              <div className="space-y-2" role="radiogroup" aria-label="Chọn địa chỉ">
                {addresses.data?.map(a => (
                  <label key={a.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${addressId === a.id ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-brand-300'}`}>
                    <input type="radio" name="addr" className="mt-1 accent-brand-600" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <span className="text-sm">
                      <span className="font-semibold">{a.recipientName}</span> · {a.phone} {a.isDefault && <span className="ml-1 rounded bg-brand-100 px-1.5 text-xs text-brand-700">Mặc định</span>}
                      <span className="block text-slate-500">{[a.line1, a.ward, a.district, a.province].filter(Boolean).join(', ')}</span>
                    </span>
                  </label>
                ))}
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 ${addressId === 'new' ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-brand-300'}`}>
                  <input type="radio" name="addr" className="accent-brand-600" checked={addressId === 'new'} onChange={() => setAddressId('new')} />
                  <span className="text-sm font-medium">Giao tới địa chỉ khác</span>
                </label>
              </div>
            )}
            {addressId === 'new' && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input label="Họ tên người nhận" required autoComplete="name" {...form.register('recipientName')} error={err.recipientName?.message} />
                <Input label="Số điện thoại" required type="tel" autoComplete="tel" {...form.register('phone')} error={err.phone?.message} />
                <Input label="Địa chỉ" required wrapperClassName="sm:col-span-2" placeholder="Số nhà, tên đường" autoComplete="street-address" {...form.register('line1')} error={err.line1?.message} />
                <Input label="Phường/Xã" {...form.register('ward')} error={err.ward?.message} />
                <Input label="Quận/Huyện" required {...form.register('district')} error={err.district?.message} />
                <Input label="Tỉnh/Thành phố" required wrapperClassName="sm:col-span-2" {...form.register('province')} error={err.province?.message} />
                <Checkbox label="Lưu vào sổ địa chỉ" {...form.register('saveToAddressBook')} />
              </div>
            )}
            <Textarea label="Ghi chú cho đơn hàng" wrapperClassName="mt-4" className="min-h-20" placeholder="Ví dụ: giao giờ hành chính" {...form.register('note')} />
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="pay-h">
            <h2 id="pay-h" className="mb-4 flex items-center gap-2 text-lg font-semibold"><CreditCard className="size-5 text-brand-600" />Phương thức thanh toán</h2>
            {methods.isLoading ? <Skeleton className="h-24" /> : (
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Phương thức thanh toán">
                {methods.data?.map(m => (
                  <label key={m.code} className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 ${method === m.code ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-brand-300'}`}>
                    <input type="radio" name="method" className="mt-1 accent-brand-600" checked={method === m.code} onChange={() => setMethod(m.code)} />
                    <span className="text-sm"><span className="block font-semibold">{m.name}</span><span className="text-slate-500">{m.description}</span></span>
                  </label>
                ))}
              </div>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Lock className="size-3.5" />PhoneHub không lưu thông tin thẻ. Thanh toán online được xử lý trên trang của cổng thanh toán.</p>
          </section>
        </div>

        <aside className="card h-fit p-5 sm:p-6 lg:sticky lg:top-36" aria-labelledby="sum-h">
          <h2 id="sum-h" className="mb-4 text-lg font-semibold">Đơn hàng</h2>
          {!p ? <Skeleton className="h-60" /> : (
            <>
              <ul className="mb-4 max-h-72 space-y-3 overflow-y-auto">
                {p.items.map(i => (
                  <li key={i.variantId} className="flex gap-3">
                    <img src={assetUrl(i.imageUrl)} alt="" className="size-14 shrink-0 rounded-lg bg-slate-50 object-contain" loading="lazy" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-medium">{i.productName}</p>
                      <p className="text-slate-500">{i.variantName} × {i.quantity}</p>
                      {i.issue && <p className="text-rose-600">{i.issue}</p>}
                    </div>
                    <p className="text-sm font-semibold">{formatPrice(i.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <form className="mb-4 flex gap-2" onSubmit={e => { e.preventDefault(); setCoupon(couponInput.trim().toUpperCase() || undefined) }}>
                <label htmlFor="coupon" className="sr-only">Mã giảm giá</label>
                <div className="relative flex-1">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input id="coupon" value={couponInput} onChange={e => setCouponInput(e.target.value)} placeholder="Mã giảm giá" className="input h-10 pl-9 uppercase" />
                </div>
                <Button type="submit" variant="secondary" size="sm" className="h-10" loading={preview.isFetching && !!coupon}>Áp dụng</Button>
              </form>
              {p.couponMessage && (
                <p role="status" className={`-mt-2 mb-3 text-sm ${p.couponApplied ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {p.couponApplied ? `✓ ${p.couponCode}: ` : ''}{p.couponMessage}
                </p>
              )}
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Tạm tính</dt><dd>{formatPrice(p.subtotal)}</dd></div>
                {p.discountAmount > 0 && <div className="flex justify-between text-emerald-600"><dt>Giảm giá</dt><dd>-{formatPrice(p.discountAmount)}</dd></div>}
                <div className="flex justify-between"><dt className="flex items-center gap-1 text-slate-500"><Truck className="size-4" />Giao hàng</dt><dd>{p.shippingFee ? formatPrice(p.shippingFee) : 'Miễn phí'}</dd></div>
                <div className="flex justify-between border-t border-slate-100 pt-3 text-lg font-bold"><dt>Tổng thanh toán</dt><dd className="text-sale">{formatPrice(p.total)}</dd></div>
              </dl>
              <Button size="lg" className="mt-5 w-full" loading={place.isPending} disabled={hasIssues || addressId === null} onClick={onPlace}>
                {methods.data?.find(m => m.code === method)?.isOnline ? 'Đặt hàng & thanh toán' : 'Đặt hàng'}
              </Button>
              {hasIssues && <p className="mt-2 text-center text-sm text-rose-600">Có sản phẩm không đủ hàng — vui lòng cập nhật giỏ hàng.</p>}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
