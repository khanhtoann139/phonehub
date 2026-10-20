import { Link } from 'react-router'
import { GitCompareArrows, Heart } from 'lucide-react'
import { assetUrl } from '@/lib/api'
import { discountPercent, storageLabel } from '@/lib/format'
import { useCompare, useToggleWishlist } from '@/lib/hooks'
import type { ProductCard as Card } from '@/lib/types'
import { Price, Rating } from '@/components/ui/Misc'
import { Skeleton } from '@/components/ui/Feedback'

export function ProductCard({ p, priority = false }: { p: Card; priority?: boolean }) {
  const wish = useToggleWishlist()
  const compare = useCompare()
  const pct = discountPercent(p.price, p.compareAtPrice)
  const wished = wish.isWished(p.id)
  const comparing = compare.has(p.id)

  return (
    <article className="group relative flex flex-col rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop sm:p-4">
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
        {pct > 0 && <span className="rounded-lg bg-sale px-2 py-0.5 text-xs font-bold text-white">-{pct}%</span>}
        {p.isFeatured && <span className="rounded-lg bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">Nổi bật</span>}
      </div>
      <button onClick={() => wish.toggle(p.id)} aria-pressed={wished} aria-label={wished ? `Bỏ ${p.name} khỏi yêu thích` : `Thêm ${p.name} vào yêu thích`}
        className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-slate-400 shadow-sm transition hover:text-sale">
        <Heart className={`size-4.5 ${wished ? 'fill-sale text-sale' : ''}`} />
      </button>

      <Link to={`/san-pham/${p.slug}`} className="flex flex-1 flex-col focus-visible:outline-none">
        <div className="relative mb-3 aspect-[5/6] overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-brand-50/60">
          <img src={assetUrl(p.imageUrl)} alt={p.name} width={300} height={360} loading={priority ? 'eager' : 'lazy'} decoding="async"
            className="size-full object-contain p-3 transition duration-300 group-hover:scale-105" />
          {!p.inStock && <span className="absolute inset-x-3 bottom-3 rounded-lg bg-slate-900/75 py-1 text-center text-xs font-semibold text-white">Tạm hết hàng</span>}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{p.brandName}</p>
        <h3 className="mt-0.5 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-ink group-hover:text-brand-700 sm:text-[15px]">{p.name}</h3>
        <div className="mt-2 flex flex-wrap gap-1">
          {p.storages.slice(0, 3).map(s => <span key={s} className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">{storageLabel(s)}</span>)}
        </div>
        <div className="mt-2.5"><Price price={p.price} compareAt={p.compareAtPrice} size="sm" /></div>
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1" aria-label="Màu sắc">
          {p.colors.slice(0, 5).map(c => <span key={c} className="size-3.5 rounded-full ring-1 ring-slate-300" style={{ backgroundColor: c }} />)}
        </div>
        {p.ratingCount > 0 ? <Rating value={p.ratingAvg} count={p.ratingCount} /> : <span className="text-xs text-slate-400">Chưa có đánh giá</span>}
      </div>
      <button onClick={() => compare.toggle({ id: p.id, name: p.name, imageUrl: p.imageUrl })} aria-pressed={comparing}
        className={`mt-3 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${comparing ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-brand-700'}`}>
        <GitCompareArrows className="size-3.5" aria-hidden /> {comparing ? 'Đang so sánh' : 'So sánh'}
      </button>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4" aria-hidden>
      <Skeleton className="mb-3 aspect-[5/6] w-full rounded-xl" />
      <Skeleton className="mb-2 h-3 w-16" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-3 h-4 w-2/3" />
      <Skeleton className="h-5 w-24" />
    </div>
  )
}

export function ProductGrid({ items, loading, count = 8, cols = 'lg:grid-cols-4' }: { items?: Card[]; loading?: boolean; count?: number; cols?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 ${cols}`} aria-busy={loading}>
      {loading ? Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />) : items?.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}
    </div>
  )
}
