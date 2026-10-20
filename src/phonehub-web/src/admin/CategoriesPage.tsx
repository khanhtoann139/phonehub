import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/hooks'
import type { AdminCategory } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal, Seo } from '@/components/ui/Misc'
import { ActiveBadge, applyFieldErrors, ConfirmDialog, DataTable, IconButton, PageHeader, TableSkeleton, td, th, useAdminCategories } from './shared'

const schema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên').max(100),
  slug: z.string().trim().max(120).regex(/^[a-z0-9-]*$/, 'Slug chỉ gồm a-z, 0-9, -'),
  description: z.string().max(1000),
  parentId: z.string(),
  sortOrder: z.coerce.number({ invalid_type_error: 'Số không hợp lệ' }).int(),
  isActive: z.boolean(),
})
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

export default function CategoriesPage() {
  const q = useAdminCategories()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<AdminCategory | null>(null)
  const nameOf = (id?: number | null) => q.data?.find(c => c.id === id)?.name

  const del = useMutation({
    mutationFn: (id: number) => api.del(`/api/admin/categories/${id}`),
    onSuccess: () => { toast.success('Đã xóa danh mục'); setToDelete(null); qc.invalidateQueries({ queryKey: ['admin', 'categories'] }) },
    onError: e => { toast.error(errorMessage(e)); setToDelete(null) },
  })

  return (
    <>
      <Seo title="Danh mục — Quản trị" />
      <PageHeader title="Danh mục" description="Phân loại sản phẩm, hỗ trợ danh mục cha – con."
        actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>Thêm danh mục</Button>} />

      {q.isPending ? <TableSkeleton cols={5} /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        : q.data.length === 0 ? (
          <div className="card"><EmptyState icon={<FolderTree className="size-8" aria-hidden />} title="Chưa có danh mục"
            action={<Button size="sm" onClick={() => setEditing('new')}>Thêm danh mục</Button>} /></div>
        ) : (
          <DataTable head={<>
            <th className={th}>Danh mục</th><th className={th}>Slug</th><th className={th}>Danh mục cha</th><th className={`${th} text-center`}>Sản phẩm</th>
            <th className={`${th} text-center`}>Thứ tự</th><th className={th}>Trạng thái</th><th className={th}><span className="sr-only">Thao tác</span></th>
          </>}>
            {q.data.map(c => (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <td className={td}>
                  <p className="font-medium">{c.name}</p>
                  {c.description && <p className="line-clamp-1 max-w-xs text-xs text-slate-500">{c.description}</p>}
                </td>
                <td className={`${td} font-mono text-xs text-slate-500`}>{c.slug}</td>
                <td className={`${td} text-slate-600`}>{nameOf(c.parentId) ?? '—'}</td>
                <td className={`${td} text-center`}>{c.productCount}</td>
                <td className={`${td} text-center`}>{c.sortOrder}</td>
                <td className={td}><ActiveBadge active={c.isActive} /></td>
                <td className={`${td} text-right`}>
                  <div className="flex justify-end gap-1">
                    <IconButton label={`Sửa ${c.name}`} onClick={() => setEditing(c)}><Pencil className="size-4" /></IconButton>
                    <IconButton label={`Xóa ${c.name}`} tone="danger" onClick={() => setToDelete(c)}><Trash2 className="size-4" /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}

      {editing && <CategoryModal category={editing === 'new' ? null : editing} all={q.data ?? []} onClose={() => setEditing(null)} />}

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Xóa danh mục" danger confirmLabel="Xóa" loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        message={<>Xóa danh mục <strong>{toDelete?.name}</strong>? Không thể xóa danh mục đang có sản phẩm hoặc danh mục con — khi đó hãy ẩn danh mục.</>} />
    </>
  )
}

function CategoryModal({ category, all, onClose }: { category: AdminCategory | null; all: AdminCategory[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '', slug: category?.slug ?? '', description: category?.description ?? '',
      parentId: category?.parentId ? String(category.parentId) : '', sortOrder: category?.sortOrder ?? 0, isActive: category?.isActive ?? true,
    },
  })

  const save = useMutation({
    mutationFn: (f: FormOut) => {
      const body = { ...f, slug: f.slug || null, description: f.description || null, parentId: f.parentId ? Number(f.parentId) : null }
      return category ? api.put<AdminCategory>(`/api/admin/categories/${category.id}`, body) : api.post<AdminCategory>('/api/admin/categories', body)
    },
    onSuccess: () => {
      toast.success(category ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục')
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] })
      onClose()
    },
    onError: e => { applyFieldErrors(e, setError); toast.error(errorMessage(e)) },
  })

  return (
    <Modal open onClose={onClose} title={category ? 'Sửa danh mục' : 'Thêm danh mục'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Hủy</Button>
        <Button type="submit" form="category-form" loading={save.isPending}>Lưu</Button>
      </>}>
      <form id="category-form" noValidate onSubmit={handleSubmit(f => save.mutate(f))} className="grid gap-4">
        <Input label="Tên danh mục" required {...register('name')} error={errors.name?.message} />
        <Input label="Slug" placeholder="Để trống để tự tạo" {...register('slug')} error={errors.slug?.message} />
        <Select label="Danh mục cha" {...register('parentId')} error={errors.parentId?.message}>
          <option value="">— Không có (danh mục gốc) —</option>
          {all.filter(c => c.id !== category?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Textarea label="Mô tả" rows={3} {...register('description')} error={errors.description?.message} />
        <Input label="Thứ tự hiển thị" type="number" {...register('sortOrder')} error={errors.sortOrder?.message} />
        <Checkbox label="Hiển thị trên cửa hàng" {...register('isActive')} />
      </form>
    </Modal>
  )
}
