import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BadgePercent, Copy } from 'lucide-react'
import { api } from '@/lib/api'
import type { Promotions } from '@/lib/types'
import { formatDate, formatPrice } from '@/lib/format'
import { ProductGrid } from '@/components/product/ProductCard'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Seo } from '@/components/ui/Misc'

export default function PromotionsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['promotions'], queryFn: () => api.get<Promotions>('/api/promotions') })
  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast.success(`Đã sao chép mã ${code}`) } catch { toast.info(`Mã: ${code}`) }
  }

  return (
    <div className="container-page py-8">
      <Seo title="Khuyến mãi & mã giảm giá" description="Mã giảm giá và điện thoại đang giảm giá tại PhoneHub." />
      <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 to-brand-500 p-8 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-100"><BadgePercent className="size-5" />Ưu đãi tháng này</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Săn deal điện thoại chính hãng</h1>
        <p className="mt-2 text-brand-100">Nhập mã ở bước thanh toán — giá và giảm giá luôn được hệ thống tính lại chính xác.</p>
      </div>

      {isError ? <ErrorState className="card" error={error} onRetry={() => refetch()} /> : (
        <>
          <h2 className="mb-4 text-xl font-bold">Mã giảm giá</h2>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
          ) : data!.coupons.length === 0 ? (
            <EmptyState className="card" title="Hiện chưa có mã giảm giá" description="Quay lại sau để nhận ưu đãi mới nhé!" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data!.coupons.map(c => (
                <div key={c.code} className="flex overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-card">
                  <div className="grid w-28 shrink-0 place-items-center bg-brand-600 p-3 text-center text-white">
                    <span className="text-2xl font-extrabold leading-tight">{c.type === 'percent' ? `${c.value}%` : `${c.value / 1000}K`}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-sm font-medium">{c.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.minOrderAmount > 0 ? `Đơn từ ${formatPrice(c.minOrderAmount)}` : 'Mọi đơn hàng'}
                      {c.maxDiscount ? ` · Tối đa ${formatPrice(c.maxDiscount)}` : ''} · HSD {formatDate(c.endsAt)}
                    </p>
                    <button onClick={() => copy(c.code)} className="mt-auto flex items-center justify-between rounded-lg border border-dashed border-brand-300 bg-brand-50 px-3 py-1.5 pt-1.5 font-mono text-sm font-bold text-brand-700 hover:bg-brand-100" aria-label={`Sao chép mã ${c.code}`}>
                      {c.code}<Copy className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <h2 className="mb-4 mt-12 text-xl font-bold">Điện thoại đang giảm giá</h2>
          {!isLoading && data!.saleProducts.length === 0
            ? <EmptyState className="card" title="Chưa có sản phẩm giảm giá" />
            : <ProductGrid items={data?.saleProducts} loading={isLoading} />}
        </>
      )}
    </div>
  )
}
