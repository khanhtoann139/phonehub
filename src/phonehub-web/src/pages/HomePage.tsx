import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BadgePercent, Sparkles, Zap } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { Brand, Category, ProductList, Promotions } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { ProductGrid } from '@/components/product/ProductCard'
import { ButtonLink } from '@/components/ui/Button'
import { ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Seo } from '@/components/ui/Misc'

function Section({ title, icon, to, children }: { title: string; icon?: React.ReactNode; to?: string; children: React.ReactNode }) {
  return (
    <section className="container-page mt-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">{icon}{title}</h2>
        {to && <Link to={to} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Xem tất cả <ArrowRight className="size-4" /></Link>}
      </div>
      {children}
    </section>
  )
}

export default function HomePage() {
  const featured = useQuery({ queryKey: ['products', 'featured'], queryFn: () => api.get<ProductList>('/api/products', { featured: true, pageSize: 8 }) })
  const bestsellers = useQuery({ queryKey: ['products', 'popular'], queryFn: () => api.get<ProductList>('/api/products', { sort: 'popular', pageSize: 8 }) })
  const promos = useQuery({ queryKey: ['promotions'], queryFn: () => api.get<Promotions>('/api/promotions') })
  const brands = useQuery({ queryKey: ['brands'], queryFn: () => api.get<Brand[]>('/api/brands'), staleTime: 300_000 })
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/api/categories'), staleTime: 300_000 })

  return (
    <>
      <Seo title="PhoneHub — Điện thoại chính hãng, giá tốt" description="Mua iPhone, Samsung Galaxy, Xiaomi, OPPO, vivo chính hãng. Trả góp 0%, giao nhanh 2h, 1 đổi 1 trong 30 ngày." />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-96 rounded-full bg-sky-300/20 blur-3xl" aria-hidden />
        <div className="container-page relative grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles className="size-3.5" aria-hidden /> Mới về: iPhone 17 series & Galaxy Z Fold7
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Chạm tới chiếc điện thoại <span className="text-sky-200">dành cho bạn</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-brand-100 sm:text-lg">Hàng chính hãng, giá minh bạch, so sánh cấu hình trong một chạm và giao tận nơi chỉ từ 2 giờ.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/dien-thoai" size="lg" variant="secondary" className="!bg-white !text-brand-700 hover:!bg-brand-50">Mua sắm ngay</ButtonLink>
              <ButtonLink to="/khuyen-mai" size="lg" variant="outline" className="!border-white/40 !bg-transparent !text-white hover:!bg-white/10">Xem khuyến mãi</ButtonLink>
            </div>
          </div>
          <div className="relative hidden justify-center md:flex" aria-hidden>
            {featured.data?.items.slice(0, 3).map((p, i) => (
              <img key={p.id} src={assetUrl(p.imageUrl)} alt="" width={220} height={264}
                className={`w-44 drop-shadow-2xl lg:w-52 ${i === 1 ? 'z-10 -mx-8 -translate-y-6 scale-110' : 'opacity-90'}`} />
            ))}
          </div>
        </div>
      </section>

      {/* Danh mục */}
      <section className="container-page -mt-6 relative z-10">
        <div className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link to="/dien-thoai" className="rounded-xl px-3 py-3 text-center text-sm font-semibold hover:bg-brand-50 hover:text-brand-700">Tất cả</Link>
          {categories.isLoading
            ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-11" />)
            : categories.data?.map(c => (
              <Link key={c.id} to={`/danh-muc/${c.slug}`} className="rounded-xl px-3 py-3 text-center text-sm font-semibold hover:bg-brand-50 hover:text-brand-700">
                {c.name} <span className="font-normal text-slate-400">({c.productCount})</span>
              </Link>
            ))}
        </div>
      </section>

      <Section title="Sản phẩm nổi bật" icon={<Sparkles className="size-6 text-brand-600" />} to="/dien-thoai?featured=true">
        {featured.isError ? <ErrorState error={featured.error} onRetry={() => featured.refetch()} /> : <ProductGrid items={featured.data?.items} loading={featured.isLoading} />}
      </Section>

      {/* Mã giảm giá */}
      {(promos.data?.coupons.length ?? 0) > 0 && (
        <Section title="Mã ưu đãi hôm nay" icon={<BadgePercent className="size-6 text-sale" />} to="/khuyen-mai">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {promos.data!.coupons.slice(0, 4).map(c => (
              <div key={c.code} className="relative overflow-hidden rounded-2xl border border-dashed border-brand-300 bg-gradient-to-br from-brand-50 to-white p-4">
                <p className="text-2xl font-extrabold text-brand-700">{c.type === 'percent' ? `-${c.value}%` : `-${formatPrice(c.value)}`}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.description}</p>
                <p className="mt-3 inline-block rounded-lg bg-white px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-ink ring-1 ring-brand-200">{c.code}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Bán chạy nhất" icon={<Zap className="size-6 text-amber-500" />} to="/dien-thoai?sort=popular">
        {bestsellers.isError ? <ErrorState error={bestsellers.error} onRetry={() => bestsellers.refetch()} /> : <ProductGrid items={bestsellers.data?.items} loading={bestsellers.isLoading} />}
      </Section>

      {/* Thương hiệu */}
      <Section title="Thương hiệu">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {brands.isLoading
            ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
            : brands.data?.map(b => (
              <Link key={b.id} to={`/thuong-hieu/${b.slug}`}
                className="card flex h-20 flex-col items-center justify-center transition hover:-translate-y-0.5 hover:border-brand-300">
                <span className="text-lg font-bold">{b.name}</span>
                <span className="text-xs text-slate-400">{b.productCount} sản phẩm</span>
              </Link>
            ))}
        </div>
      </Section>
    </>
  )
}
