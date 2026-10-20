import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, assetUrl } from '@/lib/api'
import { errorMessage } from '@/lib/hooks'
import type { AdminBrand } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Checkbox, Input, Textarea } from '@/components/ui/Field'
import { Modal, Seo } from '@/components/ui/Misc'
import { ActiveBadge, applyFieldErrors, ConfirmDialog, DataTable, IconButton, PageHeader, TableSkeleton, td, th, UploadButton, useAdminBrands } from './shared'

const schema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên').max(100),
  slug: z.string().trim().max(120).regex(/^[a-z0-9-]*$/, 'Slug chỉ gồm a-z, 0-9, -'),
  logoUrl: z.string().trim().max(500),
  description: z.string().max(1000),
  sortOrder: z.coerce.number({ invalid_type_error: 'Số không hợp lệ' }).int(),
  isActive: z.boolean(),
})
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

export default function BrandsPage() {
  const q = useAdminBrands()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AdminBrand | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<AdminBrand | null>(null)

  const del = useMutation({
    mutationFn: (id: number) => api.del(`/api/admin/brands/${id}`),
    onSuccess: () => { toast.success('Đã xóa thương hiệu'); setToDelete(null); qc.invalidateQueries({ queryKey: ['admin', 'brands'] }) },
    onError: e => { toast.error(errorMessage(e)); setToDelete(null) },
  })

  return (
    <>
      <Seo title="Thương hiệu — Quản trị" />
      <PageHeader title="Thương hiệu" description="Các hãng điện thoại hiển thị trên cửa hàng."
        actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>Thêm thương hiệu</Button>} />

      {q.isPending ? <TableSkeleton cols={5} /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        : q.data.length === 0 ? (
          <div className="card"><EmptyState icon={<Tag className="size-8" aria-hidden />} title="Chưa có thương hiệu"
            action={<Button size="sm" onClick={() => setEditing('new')}>Thêm thương hiệu</Button>} /></div>
        ) : (
          <DataTable head={<>
            <th className={th}>Thương hiệu</th><th className={th}>Slug</th><th className={`${th} text-center`}>Sản phẩm</th>
            <th className={`${th} text-center`}>Thứ tự</th><th className={th}>Trạng thái</th><th className={th}><span className="sr-only">Thao tác</span></th>
          </>}>
            {q.data.map(b => (
              <tr key={b.id} className="hover:bg-slate-50/60">
                <td className={td}>
                  <div className="flex items-center gap-3">
                    {b.logoUrl
                      ? <img src={assetUrl(b.logoUrl)} alt="" className="size-10 rounded-lg border border-slate-100 bg-white object-contain p-1" />
                      : <span className="grid size-10 place-items-center rounded-lg bg-brand-50 font-bold text-brand-700" aria-hidden>{b.name.charAt(0)}</span>}
                    <div className="min-w-0">
                      <p className="font-medium">{b.name}</p>
                      {b.description && <p className="line-clamp-1 max-w-xs text-xs text-slate-500">{b.description}</p>}
                    </div>
                  </div>
                </td>
                <td className={`${td} font-mono text-xs text-slate-500`}>{b.slug}</td>
                <td className={`${td} text-center`}>{b.productCount}</td>
                <td className={`${td} text-center`}>{b.sortOrder}</td>
                <td className={td}><ActiveBadge active={b.isActive} /></td>
                <td className={`${td} text-right`}>
                  <div className="flex justify-end gap-1">
                    <IconButton label={`Sửa ${b.name}`} onClick={() => setEditing(b)}><Pencil className="size-4" /></IconButton>
                    <IconButton label={`Xóa ${b.name}`} tone="danger" onClick={() => setToDelete(b)}><Trash2 className="size-4" /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}

      {editing && <BrandModal brand={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Xóa thương hiệu" danger confirmLabel="Xóa" loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        message={<>Xóa thương hiệu <strong>{toDelete?.name}</strong>? Không thể xóa thương hiệu đang có sản phẩm — khi đó hãy ẩn thương hiệu.</>} />
    </>
  )
}

function BrandModal({ brand, onClose }: { brand: AdminBrand | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, setError, setValue, watch, formState: { errors } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: brand?.name ?? '', slug: brand?.slug ?? '', logoUrl: brand?.logoUrl ?? '', description: brand?.description ?? '',
      sortOrder: brand?.sortOrder ?? 0, isActive: brand?.isActive ?? true,
    },
  })
  const logo = watch('logoUrl')

  const save = useMutation({
    mutationFn: (f: FormOut) => {
      const body = { ...f, slug: f.slug || null, logoUrl: f.logoUrl || null, description: f.description || null }
      return brand ? api.put<AdminBrand>(`/api/admin/brands/${brand.id}`, body) : api.post<AdminBrand>('/api/admin/brands', body)
    },
    onSuccess: () => {
      toast.success(brand ? 'Đã cập nhật thương hiệu' : 'Đã thêm thương hiệu')
      qc.invalidateQueries({ queryKey: ['admin', 'brands'] })
      onClose()
    },
    onError: e => { applyFieldErrors(e, setError); toast.error(errorMessage(e)) },
  })

  return (
    <Modal open onClose={onClose} title={brand ? 'Sửa thương hiệu' : 'Thêm thương hiệu'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Hủy</Button>
        <Button type="submit" form="brand-form" loading={save.isPending}>Lưu</Button>
      </>}>
      <form id="brand-form" noValidate onSubmit={handleSubmit(f => save.mutate(f))} className="grid gap-4">
        <Input label="Tên thương hiệu" required {...register('name')} error={errors.name?.message} />
        <Input label="Slug" placeholder="Để trống để tự tạo" {...register('slug')} error={errors.slug?.message} />
        <div>
          <Input label="Logo (URL)" {...register('logoUrl')} error={errors.logoUrl?.message} />
          <div className="mt-2 flex items-center gap-3">
            {logo && <img src={assetUrl(logo)} alt="Xem trước logo" className="size-12 rounded-lg border border-slate-100 object-contain p-1" />}
            <UploadButton onUploaded={url => setValue('logoUrl', url, { shouldDirty: true })} />
          </div>
        </div>
        <Textarea label="Mô tả" rows={3} {...register('description')} error={errors.description?.message} />
        <Input label="Thứ tự hiển thị" type="number" {...register('sortOrder')} error={errors.sortOrder?.message} />
        <Checkbox label="Hiển thị trên cửa hàng" {...register('isActive')} />
      </form>
    </Modal>
  )
}
