import { useQuery } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { ProductCard } from '@/lib/types'
import { ProductGrid } from '@/components/product/ProductCard'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Seo } from '@/components/ui/Misc'

export default function WishlistPage() {
  const { status } = useAuth()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['wishlist', 'items'],
    queryFn: () => api.get<ProductCard[]>('/api/wishlist'),
    enabled: status === 'authenticated',
  })

  return (
    <div className="container-page py-8">
      <Seo title="Sản phẩm yêu thích" />
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Sản phẩm yêu thích</h1>
      {status === 'anonymous' ? (
        <EmptyState className="card" icon={<Heart className="size-8" />} title="Đăng nhập để xem danh sách yêu thích" action={<ButtonLink to="/dang-nhap?next=/yeu-thich">Đăng nhập</ButtonLink>} />
      ) : isError ? (
        <ErrorState className="card" error={error} onRetry={() => refetch()} />
      ) : !isLoading && status === 'authenticated' && data?.length === 0 ? (
        <EmptyState className="card" icon={<Heart className="size-8" />} title="Chưa có sản phẩm yêu thích" description="Bấm biểu tượng trái tim để lưu sản phẩm bạn quan tâm." action={<ButtonLink to="/dien-thoai">Khám phá điện thoại</ButtonLink>} />
      ) : (
        <ProductGrid items={data} loading={isLoading || status === 'loading'} />
      )}
    </div>
  )
}
