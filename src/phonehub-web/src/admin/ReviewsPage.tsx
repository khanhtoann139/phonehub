import { useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Eye, EyeOff, MessageSquareText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { errorMessage } from '@/lib/hooks'
import type { AdminReview, Paged } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Pagination, Rating, Seo } from '@/components/ui/Misc'
import { ConfirmDialog, fmtDateTime, IconButton, PAGE_SIZE, PageHeader, SearchBox, Segmented, StatusBadge, TableSkeleton, Toolbar, useListParams } from './shared'

type Status = '' | 'approved' | 'hidden'

export default function ReviewsPage() {
  const { values, page, set, setPage } = useListParams(['q', 'status'] as const)
  const qc = useQueryClient()
  const [toDelete, setToDelete] = useState<AdminReview | null>(null)
  const params = { ...values, page, pageSize: PAGE_SIZE }
  const q = useQuery({
    queryKey: ['admin', 'reviews', params],
    queryFn: () => api.get<Paged<AdminReview>>('/api/admin/reviews', params),
    placeholderData: keepPreviousData,
  })

  const toggle = useMutation({
    mutationFn: (r: AdminReview) => api.put(`/api/admin/reviews/${r.id}`, { isApproved: !r.isApproved }),
    onSuccess: (_, r) => { toast.success(r.isApproved ? 'Đã ẩn đánh giá' : 'Đã duyệt đánh giá'); qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }) },
    onError: e => toast.error(errorMessage(e)),
  })
  const del = useMutation({
    mutationFn: (id: number) => api.del(`/api/admin/reviews/${id}`),
    onSuccess: () => { toast.success('Đã xóa đánh giá'); setToDelete(null); qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }) },
    onError: e => toast.error(errorMessage(e)),
  })

  return (
    <>
      <Seo title="Đánh giá — Quản trị" />
      <PageHeader title="Đánh giá" description="Kiểm duyệt đánh giá sản phẩm của khách hàng." />

      <Toolbar>
        <SearchBox value={values.q} onChange={v => set({ q: v })} placeholder="Tìm theo tên sản phẩm hoặc nội dung…" label="Tìm đánh giá" />
        <Segmented<Status> label="Lọc theo trạng thái" value={values.status as Status} onChange={v => set({ status: v })}
          options={[{ value: '', label: 'Tất cả' }, { value: 'approved', label: 'Đang hiển thị' }, { value: 'hidden', label: 'Đã ẩn' }]} />
      </Toolbar>

      {q.isPending ? <TableSkeleton rows={4} cols={3} /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        : q.data.items.length === 0 ? (
          <div className="card"><EmptyState icon={<MessageSquareText className="size-8" aria-hidden />} title="Không có đánh giá nào" /></div>
        ) : (
          <>
            <ul className="space-y-3">
              {q.data.items.map(r => (
                <li key={r.id} className={`card p-5 ${r.isApproved ? '' : 'bg-slate-50/80'}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Rating value={r.rating} />
                        <StatusBadge tone={r.isApproved ? 'green' : 'gray'}>{r.isApproved ? 'Đang hiển thị' : 'Đã ẩn'}</StatusBadge>
                        {r.isVerifiedPurchase && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><BadgeCheck className="size-3.5" aria-hidden />Đã mua hàng</span>}
                      </div>
                      <Link to={`/admin/san-pham/${r.productId}`} className="mt-2 block text-sm font-semibold text-brand-700 hover:underline">{r.productName}</Link>
                      {r.title && <p className="mt-1 font-medium">{r.title}</p>}
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.content}</p>
                      <p className="mt-2 text-xs text-slate-500">{r.authorName} · {r.authorEmail} · {fmtDateTime(r.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant={r.isApproved ? 'outline' : 'secondary'} loading={toggle.isPending && toggle.variables?.id === r.id}
                        icon={r.isApproved ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />} onClick={() => toggle.mutate(r)}>
                        {r.isApproved ? 'Ẩn' : 'Duyệt'}
                      </Button>
                      <IconButton label="Xóa đánh giá" tone="danger" onClick={() => setToDelete(r)}><Trash2 className="size-4" /></IconButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-500">Tổng cộng {formatNumber(q.data.total)} đánh giá</p>
            <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} />
          </>
        )}

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Xóa đánh giá" danger confirmLabel="Xóa" loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        message={<>Xóa vĩnh viễn đánh giá của <strong>{toDelete?.authorName}</strong> cho <strong>{toDelete?.productName}</strong>? Nếu chỉ muốn ẩn, hãy dùng nút “Ẩn”.</>} />
    </>
  )
}
