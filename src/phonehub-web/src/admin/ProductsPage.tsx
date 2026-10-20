import { useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, assetUrl } from '@/lib/api'
import { formatNumber, formatPrice } from '@/lib/format'
import { errorMessage } from '@/lib/hooks'
import type { AdminProductRow, Paged } from '@/lib/types'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Pagination, Seo } from '@/components/ui/Misc'
import {
  ActiveBadge, ConfirmDialog, DataTable, IconButton, PAGE_SIZE, PageHeader, SearchBox, StatusBadge, TableSkeleton, td, th, Toolbar,
  useAdminBrands, useAdminCategories, useListParams, type DeleteResult,
} from './shared'

export default function ProductsPage() {
  const { values, page, set, setPage } = useListParams(['q', 'status', 'brandId', 'categoryId'] as const)
  const brands = useAdminBrands()
  const categories = useAdminCategories()
  const qc = useQueryClient()
  const [toDelete, setToDelete] = useState<AdminProductRow | null>(null)

  const params = { ...values, page, pageSize: PAGE_SIZE }
  const q = useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: () => api.get<Paged<AdminProductRow>>('/api/admin/products', params),
    placeholderData: keepPreviousData,
  })

  const del = useMutation({
    mutationFn: (id: number) => api.del<DeleteResult>(`/api/admin/products/${id}`),
    onSuccess: res => {
      if (res?.softDeleted) toast.info(res.message ?? 'Sản phẩm đã được chuyển sang ẩn')
      else toast.success('Đã xóa sản phẩm')
      setToDelete(null)
      qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: e => toast.error(errorMessage(e)),
  })

  const filterSelect = 'input w-auto min-w-36 pr-8'

  return (
    <>
      <Seo title="Sản phẩm — Quản trị" />
      <PageHeader title="Sản phẩm" description="Quản lý danh mục sản phẩm, biến thể và hình ảnh."
        actions={<ButtonLink to="/admin/san-pham/moi"><Plus className="size-4" aria-hidden />Thêm sản phẩm</ButtonLink>} />

      <Toolbar>
        <SearchBox value={values.q} onChange={v => set({ q: v })} placeholder="Tìm theo tên hoặc SKU…" label="Tìm sản phẩm" />
        <div className="flex flex-wrap gap-2">
          <select aria-label="Lọc theo trạng thái" className={filterSelect} value={values.status} onChange={e => set({ status: e.target.value })}>
            <option value="">Mọi trạng thái</option>
            <option value="active">Đang bán</option>
            <option value="inactive">Đang ẩn</option>
          </select>
          <select aria-label="Lọc theo thương hiệu" className={filterSelect} value={values.brandId} onChange={e => set({ brandId: e.target.value })}>
            <option value="">Mọi thương hiệu</option>
            {brands.data?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select aria-label="Lọc theo danh mục" className={filterSelect} value={values.categoryId} onChange={e => set({ categoryId: e.target.value })}>
            <option value="">Mọi danh mục</option>
            {categories.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </Toolbar>

      {q.isPending ? <TableSkeleton cols={6} /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        : q.data.items.length === 0 ? (
          <div className="card">
            <EmptyState icon={<Smartphone className="size-8" aria-hidden />} title="Không có sản phẩm nào"
              description={values.q || values.status || values.brandId || values.categoryId ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Bắt đầu bằng cách thêm sản phẩm đầu tiên.'}
              action={<ButtonLink to="/admin/san-pham/moi" size="sm"><Plus className="size-4" aria-hidden />Thêm sản phẩm</ButtonLink>} />
          </div>
        ) : (
          <>
            <DataTable head={<>
              <th className={th}>Sản phẩm</th><th className={th}>Thương hiệu</th><th className={th}>Danh mục</th>
              <th className={`${th} text-right`}>Giá</th><th className={`${th} text-right`}>Tồn kho</th><th className={`${th} text-center`}>Biến thể</th>
              <th className={th}>Trạng thái</th><th className={`${th} text-right`}><span className="sr-only">Thao tác</span></th>
            </>}>
              {q.data.items.map(p => (
                <tr key={p.id} className={`hover:bg-slate-50/60 ${q.isPlaceholderData ? 'opacity-60' : ''}`}>
                  <td className={td}>
                    <Link to={`/admin/san-pham/${p.id}`} className="flex items-center gap-3">
                      <img src={assetUrl(p.imageUrl)} alt="" className="size-12 shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-0.5" loading="lazy" />
                      <span className="min-w-0">
                        <span className="line-clamp-2 font-medium text-ink hover:text-brand-700">{p.name}</span>
                        <span className="block text-xs text-slate-400">{p.slug}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={td}>{p.brandName}</td>
                  <td className={td}>{p.categoryName}</td>
                  <td className={`${td} whitespace-nowrap text-right font-medium`}>
                    {p.variantCount === 0 ? '—' : p.minPrice === p.maxPrice ? formatPrice(p.minPrice) : <>{formatPrice(p.minPrice)}<span className="block text-xs font-normal text-slate-500">đến {formatPrice(p.maxPrice)}</span></>}
                  </td>
                  <td className={`${td} text-right font-semibold ${p.totalStock === 0 ? 'text-rose-600' : ''}`}>{formatNumber(p.totalStock)}</td>
                  <td className={`${td} text-center`}>{p.variantCount}</td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      <ActiveBadge active={p.isActive} on="Đang bán" />
                      {p.isFeatured && <StatusBadge tone="blue">Nổi bật</StatusBadge>}
                    </div>
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="flex justify-end gap-1">
                      <Link to={`/admin/san-pham/${p.id}`} aria-label={`Sửa ${p.name}`} title="Sửa"
                        className="grid size-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-brand-700">
                        <Pencil className="size-4" />
                      </Link>
                      <IconButton label={`Xóa ${p.name}`} tone="danger" onClick={() => setToDelete(p)}><Trash2 className="size-4" /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
            <p className="mt-3 text-sm text-slate-500">Tổng cộng {formatNumber(q.data.total)} sản phẩm</p>
            <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} />
          </>
        )}

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Xóa sản phẩm" danger confirmLabel="Xóa" loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        message={<>Bạn chắc chắn muốn xóa <strong>{toDelete?.name}</strong>? Nếu sản phẩm đã có đơn hàng, hệ thống sẽ chuyển sang ẩn thay vì xóa.</>} />
    </>
  )
}
