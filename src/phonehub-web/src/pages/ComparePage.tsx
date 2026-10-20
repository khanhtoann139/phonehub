import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { GitCompareArrows, X } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { CompareItem } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { useCompare } from '@/lib/hooks'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Rating, Seo } from '@/components/ui/Misc'

export default function ComparePage() {
  const { list, remove, clear } = useCompare()
  const ids = list.map(x => x.id).join(',')
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['compare', ids],
    queryFn: () => api.get<CompareItem[]>('/api/products/compare', { ids }),
    enabled: list.length > 0,
  })

  if (list.length === 0)
    return (
      <div className="container-page py-10">
        <Seo title="So sánh điện thoại" />
        <EmptyState className="card" icon={<GitCompareArrows className="size-8" />} title="Chưa có sản phẩm để so sánh"
          description="Bấm “So sánh” trên thẻ sản phẩm để thêm tối đa 4 điện thoại." action={<ButtonLink to="/dien-thoai">Chọn điện thoại</ButtonLink>} />
      </div>
    )

  const specKeys = [...new Set((data ?? []).flatMap(p => Object.keys(p.specs)))]
  const rows: [string, (p: CompareItem) => React.ReactNode][] = [
    ['Giá từ', p => <span className="font-bold text-sale">{formatPrice(p.minPrice)}</span>],
    ['Đánh giá', p => p.ratingCount ? <Rating value={p.ratingAvg} count={p.ratingCount} /> : '—'],
    ['Thương hiệu', p => p.brandName],
    ['Dung lượng', p => p.storages.join(' / ')],
    ['Màu sắc', p => p.colors.join(', ')],
    ...specKeys.map(k => [k, (p: CompareItem) => p.specs[k] ?? '—'] as [string, (p: CompareItem) => React.ReactNode]),
  ]

  return (
    <div className="container-page py-8">
      <Seo title="So sánh điện thoại" />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">So sánh điện thoại</h1>
        <button onClick={clear} className="text-sm text-slate-500 hover:text-rose-600">Xóa tất cả</button>
      </div>
      {isError ? <ErrorState error={error} onRetry={() => refetch()} className="card" /> : isLoading || !data ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Bảng so sánh thông số</caption>
            <thead>
              <tr>
                <th scope="col" className="w-40 p-4 text-left align-bottom text-slate-500">Sản phẩm</th>
                {data.map(p => (
                  <th key={p.id} scope="col" className="relative p-4 text-center align-top font-normal">
                    <button onClick={() => remove(p.id)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-rose-600" aria-label={`Bỏ ${p.name}`}><X className="size-4" /></button>
                    <img src={assetUrl(p.imageUrl)} alt="" className="mx-auto h-36 object-contain" loading="lazy" />
                    <Link to={`/san-pham/${p.slug}`} className="mt-2 block font-semibold text-ink hover:text-brand-700">{p.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, render]) => (
                <tr key={label} className="border-t border-slate-100 odd:bg-slate-50/60">
                  <th scope="row" className="p-3 text-left font-medium text-slate-500">{label}</th>
                  {data.map(p => <td key={p.id} className="p-3 text-center">{render(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
