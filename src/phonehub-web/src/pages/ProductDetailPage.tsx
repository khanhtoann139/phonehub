import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { BadgeCheck, ChevronRight, GitCompareArrows, Heart, Minus, Plus, ShieldCheck, ShoppingCart, Star, Truck } from 'lucide-react'
import { api, ApiError, assetUrl } from '@/lib/api'
import type { ProductDetail, ProductList, ReviewList } from '@/lib/types'
import { formatDate, storageLabel } from '@/lib/format'
import { errorMessage, useAddToCart, useCompare, useRequireLogin, useToggleWishlist } from '@/lib/hooks'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Textarea, Input } from '@/components/ui/Field'
import { Pagination, Price, Rating, Seo } from '@/components/ui/Misc'
import { ProductGrid } from '@/components/product/ProductCard'

function DetailSkeleton() {
  return (
    <div className="container-page grid gap-8 py-8 lg:grid-cols-2" aria-busy>
      <Skeleton className="aspect-square w-full rounded-3xl" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" /><Skeleton className="h-5 w-40" /><Skeleton className="h-10 w-56" />
        <Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

const reviewSchema = z.object({
  rating: z.number().min(1, 'Chọn số sao').max(5),
  title: z.string().max(150).optional(),
  content: z.string().trim().min(10, 'Nội dung tối thiểu 10 ký tự').max(2000),
})
type ReviewForm = z.infer<typeof reviewSchema>

function Reviews({ productId }: { productId: number }) {
  const [page, setPage] = useState(1)
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reviews', productId, page],
    queryFn: () => api.get<ReviewList>(`/api/products/${productId}/reviews`, { page, pageSize: 5 }),
  })
  const form = useForm<ReviewForm>({ resolver: zodResolver(reviewSchema), defaultValues: { rating: 0, title: '', content: '' } })
  const rating = form.watch('rating')
  const submit = useMutation({
    mutationFn: (v: ReviewForm) => api.post(`/api/products/${productId}/reviews`, v),
    onSuccess: () => {
      toast.success('Cảm ơn bạn đã đánh giá!')
      form.reset()
      qc.invalidateQueries({ queryKey: ['reviews', productId] })
      qc.invalidateQueries({ queryKey: ['product'] })
    },
    onError: e => toast.error(errorMessage(e)),
  })

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (isLoading || !data) return <Skeleton className="h-48" />

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <div>
        <p className="text-5xl font-extrabold">{data.average.toFixed(1)}<span className="text-xl text-slate-400">/5</span></p>
        <Rating value={data.average} size="md" />
        <p className="mt-1 text-sm text-slate-500">{data.count} đánh giá</p>
        <div className="mt-4 space-y-1.5">
          {[5, 4, 3, 2, 1].map(star => {
            const n = data.distribution[star - 1]
            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-slate-600">{star}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${data.count ? (n / data.count) * 100 : 0}%` }} /></div>
                <span className="w-6 text-right text-slate-500">{n}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div>
        {data.canReview && (
          <form onSubmit={form.handleSubmit(v => submit.mutate(v))} className="mb-6 rounded-2xl border border-brand-100 bg-brand-50/50 p-4" noValidate>
            <p className="mb-2 font-semibold">Chia sẻ trải nghiệm của bạn</p>
            <div className="mb-3 flex gap-1" role="radiogroup" aria-label="Số sao">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} sao`} onClick={() => form.setValue('rating', i, { shouldValidate: true })}>
                  <Star className={`size-7 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
            {form.formState.errors.rating && <p role="alert" className="mb-2 text-xs text-rose-600">{form.formState.errors.rating.message}</p>}
            <Input placeholder="Tiêu đề (không bắt buộc)" {...form.register('title')} wrapperClassName="mb-3" aria-label="Tiêu đề" />
            <Textarea placeholder="Sản phẩm dùng thế nào?" {...form.register('content')} error={form.formState.errors.content?.message} aria-label="Nội dung đánh giá" />
            <Button type="submit" className="mt-3" loading={submit.isPending}>Gửi đánh giá</Button>
          </form>
        )}
        {!data.canReview && !data.hasReviewed && <p className="mb-4 text-sm text-slate-500">Chỉ khách đã mua và nhận hàng mới có thể đánh giá sản phẩm.</p>}
        {data.items.length === 0 ? (
          <EmptyState icon={<Star className="size-8" />} title="Chưa có đánh giá" description="Hãy là người đầu tiên đánh giá sản phẩm này." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map(r => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.authorName}</span>
                  {r.isVerifiedPurchase && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><BadgeCheck className="size-3.5" />Đã mua hàng</span>}
                  <span className="text-xs text-slate-400">{formatDate(r.createdAt)}</span>
                </div>
                <Rating value={r.rating} />
                {r.title && <p className="mt-1 font-medium">{r.title}</p>}
                <p className="mt-1 text-sm text-slate-700">{r.content}</p>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  const { slug = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const { data: p, isLoading, isError, error, refetch } = useQuery({ queryKey: ['product', slug], queryFn: () => api.get<ProductDetail>(`/api/products/${slug}`) })
  const related = useQuery({
    queryKey: ['products', 'related', p?.brand.slug],
    queryFn: () => api.get<ProductList>('/api/products', { brand: p!.brand.slug, pageSize: 5 }),
    enabled: !!p,
  })

  const colors = useMemo(() => p ? [...new Map(p.variants.map(v => [v.color, v.colorHex])).entries()] : [], [p])
  const storages = useMemo(() => p ? [...new Set(p.variants.map(v => v.storageGb))].sort((a, b) => a - b) : [], [p])
  const color = sp.get('mau') ?? colors[0]?.[0]
  const firstStorageForColor = p?.variants.find(v => v.color === color)?.storageGb
  const storage = Number(sp.get('dl')) || firstStorageForColor || storages[0]
  const variant = p?.variants.find(v => v.color === color && v.storageGb === storage)
  const [qty, setQty] = useState(1)
  const [imgIdx, setImgIdx] = useState(0)
  const images = useMemo(() => {
    if (!p) return []
    const own = p.images.filter(i => i.color === color)
    return own.length ? own : p.images
  }, [p, color])
  useEffect(() => setImgIdx(0), [color])
  useEffect(() => setQty(1), [variant?.id])

  const add = useAddToCart()
  const wish = useToggleWishlist()
  const compare = useCompare()
  const requireLogin = useRequireLogin()

  if (isLoading) return <DetailSkeleton />
  if (isError || !p) {
    if (error instanceof ApiError && error.status === 404)
      return <EmptyState className="container-page py-20" title="Không tìm thấy sản phẩm" description="Sản phẩm có thể đã ngừng kinh doanh." action={<Link to="/dien-thoai" className="text-brand-700 underline">Xem sản phẩm khác</Link>} />
    return <ErrorState className="container-page py-20" error={error} onRetry={() => refetch()} />
  }

  const choose = (patch: Record<string, string>) => setSp({ mau: color ?? '', dl: String(storage ?? ''), ...patch }, { replace: true, preventScrollReset: true })
  const stock = variant?.stock ?? 0
  const addToCart = async (buyNow: boolean) => {
    if (!variant || !requireLogin('Đăng nhập để thêm sản phẩm vào giỏ hàng')) return
    try {
      await add.mutateAsync({ variantId: variant.id, quantity: qty })
      if (buyNow) navigate('/gio-hang')
    } catch { /* lỗi đã hiện bằng toast */ }
  }

  return (
    <div className="container-page py-6">
      <Seo title={`${p.name}${variant ? ` ${storageLabel(variant.storageGb)}` : ''} chính hãng`} description={p.shortDescription} image={assetUrl(images[0]?.url)} />
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <Link to="/" className="hover:text-brand-700">Trang chủ</Link><ChevronRight className="size-3.5" aria-hidden />
        <Link to={`/danh-muc/${p.category.slug}`} className="hover:text-brand-700">{p.category.name}</Link><ChevronRight className="size-3.5" aria-hidden />
        <Link to={`/thuong-hieu/${p.brand.slug}`} className="hover:text-brand-700">{p.brand.name}</Link><ChevronRight className="size-3.5" aria-hidden />
        <span className="text-ink">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="card relative aspect-square overflow-hidden bg-gradient-to-b from-white to-brand-50">
            <img src={assetUrl(images[imgIdx]?.url)} alt={images[imgIdx]?.alt ?? p.name} width={600} height={720} className="size-full object-contain p-6" fetchPriority="high" />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Ảnh sản phẩm">
            {images.map((img, i) => (
              <button key={img.id} role="tab" aria-selected={i === imgIdx} aria-label={img.alt} onClick={() => setImgIdx(i)}
                className={`size-20 shrink-0 rounded-xl border-2 bg-white p-1 transition ${i === imgIdx ? 'border-brand-600' : 'border-transparent hover:border-slate-200'}`}>
                <img src={assetUrl(img.url)} alt="" className="size-full object-contain" loading="lazy" />
              </button>
            ))}
          </div>
        </div>

        {/* Thông tin mua */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{p.brand.name}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            {p.ratingCount > 0 && <a href="#danh-gia" className="hover:underline"><Rating value={p.ratingAvg} count={p.ratingCount} /></a>}
            <span>Đã bán {p.soldCount}</span>
            {variant && <span>SKU: {variant.sku}</span>}
          </div>
          <p className="mt-3 text-slate-600">{p.shortDescription}</p>

          <div className="mt-5 rounded-2xl bg-gradient-to-r from-rose-50 to-white p-4">
            {variant ? <Price price={variant.price} compareAt={variant.compareAtPrice} size="lg" /> : <p className="font-semibold text-slate-500">Phiên bản không có sẵn</p>}
          </div>

          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-semibold">Dung lượng</legend>
            <div className="flex flex-wrap gap-2">
              {storages.map(s => {
                const v = p.variants.find(x => x.color === color && x.storageGb === s)
                return (
                  <button key={s} className="chip min-w-24 flex-col !gap-0 !rounded-xl !py-2" aria-pressed={s === storage} disabled={!v} onClick={() => choose({ dl: String(s) })}>
                    <span className="font-semibold">{storageLabel(s)}</span>
                    {v && <span className="text-xs text-slate-500">{(v.price / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tr</span>}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-semibold">Màu sắc: <span className="font-normal text-slate-600">{color}</span></legend>
            <div className="flex flex-wrap gap-2">
              {colors.map(([name, hex]) => (
                <button key={name} className="chip !pl-1.5" aria-pressed={name === color} onClick={() => {
                  const keep = p.variants.some(v => v.color === name && v.storageGb === storage)
                  choose({ mau: name, dl: String(keep ? storage : p.variants.find(v => v.color === name)!.storageGb) })
                }}>
                  <span className="size-6 rounded-full ring-1 ring-slate-300" style={{ backgroundColor: hex }} aria-hidden />{name}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 flex items-center gap-4">
            <div className="flex items-center rounded-xl border border-slate-300" role="group" aria-label="Số lượng">
              <button className="grid size-10 place-items-center disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty(q => q - 1)} aria-label="Giảm số lượng"><Minus className="size-4" /></button>
              <span className="w-10 text-center font-semibold" aria-live="polite">{qty}</span>
              <button className="grid size-10 place-items-center disabled:opacity-40" disabled={qty >= Math.min(5, stock)} onClick={() => setQty(q => q + 1)} aria-label="Tăng số lượng"><Plus className="size-4" /></button>
            </div>
            <span className={`text-sm ${stock === 0 ? 'text-rose-600' : stock <= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {stock === 0 ? 'Tạm hết hàng' : stock <= 5 ? `Chỉ còn ${stock} sản phẩm` : 'Còn hàng'}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Button size="lg" className="col-span-2 sm:col-span-1" disabled={!variant || stock === 0} loading={add.isPending} onClick={() => addToCart(true)}>Mua ngay</Button>
            <Button size="lg" variant="secondary" disabled={!variant || stock === 0} icon={<ShoppingCart className="size-5" />} onClick={() => addToCart(false)}>Thêm vào giỏ</Button>
            <Button size="lg" variant="outline" aria-pressed={wish.isWished(p.id)} aria-label="Yêu thích" onClick={() => wish.toggle(p.id)}>
              <Heart className={`size-5 ${wish.isWished(p.id) ? 'fill-sale text-sale' : ''}`} />
            </Button>
          </div>
          <button onClick={() => compare.toggle({ id: p.id, name: p.name, imageUrl: images[0]?.url })} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
            <GitCompareArrows className="size-4" /> {compare.has(p.id) ? 'Bỏ khỏi so sánh' : 'Thêm vào so sánh'}
          </button>

          <ul className="mt-6 grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
            <li className="flex gap-2"><ShieldCheck className="size-5 shrink-0 text-brand-600" />Bảo hành chính hãng 12 tháng</li>
            <li className="flex gap-2"><Truck className="size-5 shrink-0 text-brand-600" />Miễn phí giao hàng từ 2 triệu</li>
          </ul>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="card p-6">
          <h2 className="mb-3 text-xl font-bold">Đặc điểm nổi bật</h2>
          <div className="prose-ph">{p.description.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}</div>
        </section>
        <section className="card h-fit p-6">
          <h2 className="mb-3 text-xl font-bold">Thông số kỹ thuật</h2>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(p.specs).map(([k, v]) => (
                <tr key={k} className="odd:bg-slate-50">
                  <th scope="row" className="w-2/5 rounded-l-lg px-3 py-2.5 text-left font-medium text-slate-500">{k}</th>
                  <td className="rounded-r-lg px-3 py-2.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section id="danh-gia" className="card mt-6 scroll-mt-28 p-6">
        <h2 className="mb-5 text-xl font-bold">Đánh giá {p.name}</h2>
        <Reviews productId={p.id} />
      </section>

      {(related.data?.items.filter(x => x.id !== p.id).length ?? 0) > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">Sản phẩm cùng thương hiệu</h2>
          <ProductGrid items={related.data!.items.filter(x => x.id !== p.id).slice(0, 4)} />
        </section>
      )}
    </div>
  )
}
