import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { Address } from '@/lib/types'
import { errorMessage } from '@/lib/hooks'
import { addressSchema } from '@/lib/validation'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Modal, Seo } from '@/components/ui/Misc'

const schema = addressSchema.extend({ isDefault: z.boolean() })
type Values = z.infer<typeof schema>
const empty: Values = { recipientName: '', phone: '', line1: '', ward: '', district: '', province: '', isDefault: false }

export default function AddressesPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Address | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Address | null>(null)
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['addresses'], queryFn: () => api.get<Address[]>('/api/account/addresses') })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty })
  const err = form.formState.errors

  const open = (a: Address | 'new') => {
    setEditing(a)
    form.reset(a === 'new' ? empty : { ...a })
  }
  const save = useMutation({
    mutationFn: (v: Values) => editing && editing !== 'new' ? api.put(`/api/account/addresses/${editing.id}`, v) : api.post('/api/account/addresses', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['addresses'] }); setEditing(null); toast.success('Đã lưu địa chỉ') },
    onError: e => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/account/addresses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['addresses'] }); setDeleting(null); toast.success('Đã xóa địa chỉ') },
    onError: e => toast.error(errorMessage(e)),
  })

  return (
    <div className="card p-5 sm:p-6">
      <Seo title="Sổ địa chỉ" />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">Sổ địa chỉ</h1>
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => open('new')}>Thêm địa chỉ</Button>
      </div>
      {isError ? <ErrorState error={error} onRetry={() => refetch()} />
        : isLoading ? <Skeleton className="h-32" />
          : data!.length === 0 ? <EmptyState icon={<MapPin className="size-8" />} title="Chưa có địa chỉ" description="Thêm địa chỉ để đặt hàng nhanh hơn." />
            : (
              <ul className="grid gap-3 md:grid-cols-2">
                {data!.map(a => (
                  <li key={a.id} className={`rounded-2xl border p-4 ${a.isDefault ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{a.recipientName} {a.isDefault && <span className="ml-1 rounded bg-brand-100 px-1.5 text-xs font-medium text-brand-700">Mặc định</span>}</p>
                      <div className="flex gap-1">
                        <button onClick={() => open(a)} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Sửa địa chỉ"><Pencil className="size-4" /></button>
                        <button onClick={() => setDeleting(a)} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Xóa địa chỉ"><Trash2 className="size-4" /></button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">{a.phone}</p>
                    <p className="text-sm text-slate-600">{[a.line1, a.ward, a.district, a.province].filter(Boolean).join(', ')}</p>
                  </li>
                ))}
              </ul>
            )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Thêm địa chỉ' : 'Sửa địa chỉ'}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button><Button loading={save.isPending} onClick={form.handleSubmit(v => save.mutate(v))}>Lưu</Button></>}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(v => save.mutate(v))} noValidate>
          <Input label="Họ tên người nhận" required {...form.register('recipientName')} error={err.recipientName?.message} />
          <Input label="Số điện thoại" required type="tel" {...form.register('phone')} error={err.phone?.message} />
          <Input label="Địa chỉ" required wrapperClassName="sm:col-span-2" {...form.register('line1')} error={err.line1?.message} />
          <Input label="Phường/Xã" {...form.register('ward')} error={err.ward?.message} />
          <Input label="Quận/Huyện" required {...form.register('district')} error={err.district?.message} />
          <Input label="Tỉnh/Thành phố" required wrapperClassName="sm:col-span-2" {...form.register('province')} error={err.province?.message} />
          <Checkbox label="Đặt làm địa chỉ mặc định" {...form.register('isDefault')} />
          <button type="submit" hidden />
        </form>
      </Modal>
      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Xóa địa chỉ"
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>Hủy</Button><Button variant="danger" loading={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>Xóa</Button></>}>
        <p className="text-sm text-slate-600">Xóa địa chỉ của {deleting?.recipientName}?</p>
      </Modal>
    </div>
  )
}
