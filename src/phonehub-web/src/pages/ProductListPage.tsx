import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronRight, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { Brand, Category, ProductFacets, ProductList } from '@/lib/types'
import { parseFilters, PRICE_RANGES, SORTS, toggleIn, toSearchParams, type ProductFilters } from '@/lib/filters'
import { useDebounce } from '@/lib/hooks'
import { ProductGrid } from '@/components/product/ProductCard'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Pagination, Seo } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-slate-100 py-4 last:border-0">
      <legend className="mb-3 text-sm font-semibold text-ink">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

function Filters({ facets, f, set, lockBrand }: { facets?: ProductFacets; f: ProductFilters; set: (p: Partial<ProductFilters>) => void; lockBrand: boolean }) {
  if (!facets) return <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
  return (
    <div>
      {!lockBrand && facets.brands.length > 0 && (
        <FilterGroup title="Thương hiệu">
          {facets.brands.map(b => (
            <button key={b.value} className="chip" aria-pressed={f.brand.includes(b.value)} onClick={() => set({ brand: toggleIn(f.brand, b.value) })}>
              {b.label} <span className="text-xs text-slate-400">{b.count}</span>
            </button>
          ))}
        </FilterGroup>
      )}
      <FilterGroup title="Mức giá">
        {PRICE_RANGES.map(r => {
          const on = f.minPrice === r.min && f.maxPrice === r.max
          return <button key={r.label} className="chip" aria-pressed={on} onClick={() => set(on ? { minPrice: undefined, maxPrice: undefined } : { minPrice: r.min, maxPrice: r.max })}>{r.label}</button>
        })}
      </FilterGroup>
      <FilterGroup title="Bộ nhớ trong">
        {facets.storages.map(s => <button key={s.value} className="chip" aria-pressed={f.storage.includes(s.value)} onClick={() => set({ storage: toggleIn(f.storage, s.value) })}>{s.label}</button>)}
      </FilterGroup>
      <FilterGroup title="RAM">
        {facets.rams.map(s => <button key={s.value} className="chip" aria-pressed={f.ram.includes(s.value)} onClick={() => set({ ram: toggleIn(f.ram, s.value) })}>{s.label}</button>)}
      </FilterGroup>
      <FilterGroup title="Khác">
        <button className="chip" aria-pressed={f.onSale} onClick={() => set({ onSale: !f.onSale })}>Đang giảm giá</button>
        <button className="chip" aria-pressed={f.featured} onClick={() => set({ featured: !f.featured })}>Nổi bật</button>
      </FilterGroup>
    </div>
  )
}

export default function ProductListPage() {
  const { category, brand: brandSlug } = useParams()
  const [sp, setSp] = useSearchParams()
  const f = useMemo(() => parseFilters(sp), [sp])
  const [drawer, setDrawer] = useState(false)
  const [qInput, setQInput] = useState(f.q)
  const debouncedQ = useDebounce(qInput, 400)

  const set = (patch: Partial<ProductFilters>) => setSp(toSearchParams({ ...f, page: 1, ...patch }), { replace: false })

  // Ô tìm kiếm trong trang: debounce rồi mới đẩy lên URL
  useEffect(() => { if (debouncedQ !== f.q) set({ q: debouncedQ }) }, [debouncedQ]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setQInput(f.q) }, [f.q])

  const query = {
    q: f.q, category, brand: brandSlug ?? (f.brand.join(',') || undefined), storage: f.storage.join(',') || undefined, ram: f.ram.join(',') || undefined,
    minPrice: f.minPrice, maxPrice: f.maxPrice, sort: f.sort, page: f.page, pageSize: 12, featured: f.featured || undefined, onSale: f.onSale || undefined,
  }
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['products', query],
    queryFn: ({ signal }) => api.get<ProductList>('/api/products', query, signal),
    placeholderData: keepPreviousData,
  })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/api/categories'), staleTime: 300_000 })
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => api.get<Brand[]>('/api/brands'), staleTime: 300_000 })

  const cat = categories?.find(c => c.slug === category)
  const br = brands?.find(b => b.slug === brandSlug)
  const title = f.q ? `Kết quả tìm kiếm "${f.q}"` : cat ? `Điện thoại ${cat.name}` : br ? `Điện thoại ${br.name}` : 'Tất cả điện thoại'
  const activeCount = f.brand.length + f.storage.length + f.ram.length + (f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0) + (f.onSale ? 1 : 0) + (f.featured ? 1 : 0)

  return (
    <div className="container-page py-6">
      <Seo title={title} description={cat?.description ?? br?.description ?? 'Điện thoại chính hãng giá tốt tại PhoneHub'} />
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link to="/" className="hover:text-brand-700">Trang chủ</Link><ChevronRight className="size-3.5" aria-hidden />
        <span className="text-ink">{cat?.name ?? br?.name ?? (f.q ? 'Tìm kiếm' : 'Điện thoại')}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-500" aria-live="polite">{data ? `${data.total} sản phẩm` : ' '}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder="Lọc theo tên…" aria-label="Lọc theo tên sản phẩm" className="input h-10 flex-1 sm:w-56" />
          <label htmlFor="sort" className="sr-only">Sắp xếp</label>
          <select id="sort" value={f.sort} onChange={e => set({ sort: e.target.value })} className="input h-10 w-auto py-0">
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Button variant="outline" size="sm" className="h-10 lg:hidden" icon={<SlidersHorizontal className="size-4" />} onClick={() => setDrawer(true)}>
            Lọc{activeCount ? ` (${activeCount})` : ''}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="card hidden h-fit px-5 py-2 lg:block" aria-label="Bộ lọc">
          <div className="flex items-center justify-between pt-3">
            <h2 className="font-semibold">Bộ lọc</h2>
            {activeCount > 0 && <button onClick={() => setSp(toSearchParams({ q: f.q, sort: f.sort }))} className="text-sm text-brand-700 hover:underline">Xóa lọc</button>}
          </div>
          <Filters facets={data?.facets} f={f} set={set} lockBrand={!!brandSlug} />
        </aside>

        <section aria-busy={isLoading || isPlaceholderData} className={isPlaceholderData ? 'opacity-60 transition' : ''}>
          {isError ? (
            <ErrorState error={error} onRetry={() => refetch()} className="card" />
          ) : !isLoading && data?.items.length === 0 ? (
            <EmptyState className="card" icon={<SearchX className="size-8" />} title="Không tìm thấy sản phẩm phù hợp"
              description="Hãy thử bỏ bớt bộ lọc hoặc tìm với từ khóa khác."
              action={<Button variant="outline" onClick={() => setSp(new URLSearchParams())}>Xóa tất cả bộ lọc</Button>} />
          ) : (
            <>
              <ProductGrid items={data?.items} loading={isLoading} count={12} cols="lg:grid-cols-3 xl:grid-cols-4" />
              {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={p => { set({ page: p }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
            </>
          )}
        </section>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Bộ lọc">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold">Bộ lọc</h2>
              <button onClick={() => setDrawer(false)} aria-label="Đóng" className="grid size-9 place-items-center rounded-full hover:bg-slate-100"><X className="size-5" /></button>
            </div>
            <div className="overflow-y-auto px-5"><Filters facets={data?.facets} f={f} set={set} lockBrand={!!brandSlug} /></div>
            <div className="flex gap-2 border-t border-slate-100 p-4">
              <Button variant="outline" className="flex-1" onClick={() => setSp(toSearchParams({ q: f.q, sort: f.sort }))}>Xóa lọc</Button>
              <Button className="flex-1" onClick={() => setDrawer(false)}>Xem {data?.total ?? ''} sản phẩm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
