import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatNumber, formatPrice } from '@/lib/format'
import { errorMessage } from '@/lib/hooks'
import type { Coupon } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Checkbox, Input, Select } from '@/components/ui/Field'
import { Modal, Seo } from '@/components/ui/Misc'
import {
  applyFieldErrors, ConfirmDialog, DataTable, fmtDateTime, fromLocalInput, IconButton, PageHeader, SearchBox, StatusBadge, TableSkeleton,
  td, th, toLocalInput, Toolbar, utc, type DeleteResult, type Tone,
} from './shared'

function couponState(c: Coupon): { label: string; tone: Tone } {
  const now = Date.now()
  if (!c.isActive) return { label: 'Tắt', tone: 'gray' }
  if (new Date(utc(c.endsAt)).getTime() < now) return { label: 'Hết hạn', tone: 'red' }
  if (new Date(utc(c.startsAt)).getTime() > now) return { label: 'Chưa bắt đầu', tone: 'amber' }
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { label: 'Hết lượt', tone: 'red' }
  return { label: 'Đang chạy', tone: 'green' }
}

const optInt = (min: number, max: number) => z.preprocess(v => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number({ invalid_type_error: 'Số không hợp lệ' }).int('Số nguyên').min(min, `Tối thiểu ${min}`).max(max).nullable())
const optMoney = z.preprocess(v => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number({ invalid_type_error: 'Số không hợp lệ' }).min(0, 'Không được âm').max(1_000_000_000).nullable())

const schema = z.object({
  code: z.string().trim().min(3, 'Tối thiểu 3 ký tự').max(40).regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ, số, -, _'),
  description: z.string().max(255),
  type: z.enum(['percent', 'fixed']),
  value: z.coerce.number({ invalid_type_error: 'Nhập giá trị' }).min(1, 'Tối thiểu 1').max(1_000_000_000),
  maxDiscount: optMoney,
  minOrderAmount: z.coerce.number({ invalid_type_error: 'Số không hợp lệ' }).min(0, 'Không được âm').max(1_000_000_000),
  startsAt: z.string().min(1, 'Chọn thời điểm bắt đầu'),
  endsAt: z.string().min(1, 'Chọn thời điểm kết thúc'),
  usageLimit: optInt(1, 1_000_000),
  perUserLimit: optInt(1, 1000),
  isActive: z.boolean(),
  isPublic: z.boolean(),
}).superRefine((v, ctx) => {
  if (v.type === 'percent' && v.value > 100) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Phần trăm giảm tối đa 100' })
  if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Phải sau thời điểm bắt đầu' })
})
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

export default function CouponsPage() {
  const q = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => api.get<Coupon[]>('/api/admin/coupons') })
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Coupon | null>(null)

  const rows = useMemo(() => {
    const s = search.toLowerCase()
    return (q.data ?? []).filter(c => !s || c.code.toLowerCase().includes(s) || c.description.toLowerCase().includes(s))
  }, [q.data, search])

  const del = useMutation({
    mutationFn: (id: number) => api.del<DeleteResult>(`/api/admin/coupons/${id}`),
    onSuccess: res => {
      if (res?.softDeleted) toast.info(res.message ?? 'Mã đã được chuyển sang tắt')
      else toast.success('Đã xóa mã giảm giá')
      setToDelete(null)
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] })
    },
    onError: e => toast.error(errorMessage(e)),
  })

  return (
    <>
      <Seo title="Mã giảm giá — Quản trị" />
      <PageHeader title="Mã giảm giá" description="Tạo và quản lý chương trình khuyến mãi bằng mã."
        actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>Tạo mã giảm giá</Button>} />

      <Toolbar><SearchBox value={search} onChange={setSearch} placeholder="Tìm theo mã hoặc mô tả…" label="Tìm mã giảm giá" /></Toolbar>

      {q.isPending ? <TableSkeleton cols={6} /> : q.isError ? <div className="card"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        : rows.length === 0 ? (
          <div className="card"><EmptyState icon={<TicketPercent className="size-8" aria-hidden />} title={search ? 'Không tìm thấy mã phù hợp' : 'Chưa có mã giảm giá'}
            action={!search && <Button size="sm" onClick={() => setEditing('new')}>Tạo mã giảm giá</Button>} /></div>
        ) : (
          <DataTable head={<>
            <th className={th}>Mã</th><th className={th}>Mức giảm</th><th className={`${th} text-right`}>Đơn tối thiểu</th><th className={th}>Thời gian</th>
            <th className={`${th} text-center`}>Đã dùng</th><th className={th}>Trạng thái</th><th className={th}><span className="sr-only">Thao tác</span></th>
          </>}>
            {rows.map(c => {
              const st = couponState(c)
              return (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className={td}>
                    <p className="font-mono font-semibold text-brand-700">{c.code}</p>
                    {c.description && <p className="line-clamp-1 max-w-56 text-xs text-slate-500">{c.description}</p>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    <p className="font-semibold">{c.type === 'percent' ? `${c.value}%` : formatPrice(c.value)}</p>
                    {c.type === 'percent' && c.maxDiscount != null && <p className="text-xs text-slate-500">Tối đa {formatPrice(c.maxDiscount)}</p>}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>{c.minOrderAmount > 0 ? formatPrice(c.minOrderAmount) : '—'}</td>
                  <td className={`${td} whitespace-nowrap text-xs text-slate-600`}>{fmtDateTime(c.startsAt)}<br />→ {fmtDateTime(c.endsAt)}</td>
                  <td className={`${td} text-center`}>
                    {formatNumber(c.usedCount)}{c.usageLimit != null && <span className="text-slate-400"> / {formatNumber(c.usageLimit)}</span>}
                    {c.perUserLimit != null && <p className="text-xs text-slate-400">{c.perUserLimit}/khách</p>}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                      {c.isPublic && <StatusBadge tone="blue">Công khai</StatusBadge>}
                    </div>
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="flex justify-end gap-1">
                      <IconButton label={`Sửa mã ${c.code}`} onClick={() => setEditing(c)}><Pencil className="size-4" /></IconButton>
                      <IconButton label={`Xóa mã ${c.code}`} tone="danger" onClick={() => setToDelete(c)}><Trash2 className="size-4" /></IconButton>
                    </div>
                  </td>
                </tr>
              )
            })}
          </DataTable>
        )}

      {editing && <CouponModal coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Xóa mã giảm giá" danger confirmLabel="Xóa" loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        message={<>Xóa mã <strong className="font-mono">{toDelete?.code}</strong>? Nếu mã đã được dùng trong đơn hàng, hệ thống sẽ tắt mã thay vì xóa.</>} />
    </>
  )
}

function CouponModal({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const qc = useQueryClient()
  const now = new Date()
  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: coupon ? {
      code: coupon.code, description: coupon.description, type: coupon.type, value: coupon.value, maxDiscount: coupon.maxDiscount ?? '',
      minOrderAmount: coupon.minOrderAmount, startsAt: toLocalInput(coupon.startsAt), endsAt: toLocalInput(coupon.endsAt),
      usageLimit: coupon.usageLimit ?? '', perUserLimit: coupon.perUserLimit ?? '', isActive: coupon.isActive, isPublic: coupon.isPublic,
    } : {
      code: '', description: '', type: 'percent', value: 10, maxDiscount: '', minOrderAmount: 0,
      startsAt: toLocalInput(now.toISOString()), endsAt: toLocalInput(new Date(now.getTime() + 30 * 86_400_000).toISOString()),
      usageLimit: '', perUserLimit: 1, isActive: true, isPublic: false,
    },
  })
  const type = watch('type')

  const save = useMutation({
    mutationFn: (f: FormOut) => {
      const body = {
        ...f, code: f.code.toUpperCase(), description: f.description || null,
        maxDiscount: f.type === 'percent' ? f.maxDiscount : null,
        startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt),
      }
      return coupon ? api.put<Coupon>(`/api/admin/coupons/${coupon.id}`, body) : api.post<Coupon>('/api/admin/coupons', body)
    },
    onSuccess: () => {
      toast.success(coupon ? 'Đã cập nhật mã giảm giá' : 'Đã tạo mã giảm giá')
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] })
      onClose()
    },
    onError: e => { applyFieldErrors(e, setError); toast.error(errorMessage(e)) },
  })

  return (
    <Modal open wide onClose={onClose} title={coupon ? `Sửa mã ${coupon.code}` : 'Tạo mã giảm giá'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Hủy</Button>
        <Button type="submit" form="coupon-form" loading={save.isPending}>Lưu</Button>
      </>}>
      <form id="coupon-form" noValidate onSubmit={handleSubmit(f => save.mutate(f))} className="grid gap-4 sm:grid-cols-2">
        <Input label="Mã" required className="font-mono uppercase" {...register('code')} error={errors.code?.message} />
        <Input label="Mô tả" {...register('description')} error={errors.description?.message} />
        <Select label="Loại giảm" {...register('type')} error={errors.type?.message}>
          <option value="percent">Theo phần trăm (%)</option>
          <option value="fixed">Số tiền cố định (₫)</option>
        </Select>
        <Input label={type === 'percent' ? 'Giá trị (%)' : 'Giá trị (₫)'} required type="number" min={1} {...register('value')} error={errors.value?.message} />
        {type === 'percent' && <Input label="Giảm tối đa (₫)" type="number" min={0} placeholder="Không giới hạn" {...register('maxDiscount')} error={errors.maxDiscount?.message} />}
        <Input label="Đơn tối thiểu (₫)" type="number" min={0} {...register('minOrderAmount')} error={errors.minOrderAmount?.message} />
        <Input label="Bắt đầu" required type="datetime-local" {...register('startsAt')} error={errors.startsAt?.message} />
        <Input label="Kết thúc" required type="datetime-local" {...register('endsAt')} error={errors.endsAt?.message} />
        <Input label="Tổng lượt dùng" type="number" min={1} placeholder="Không giới hạn" {...register('usageLimit')} error={errors.usageLimit?.message} />
        <Input label="Lượt dùng mỗi khách" type="number" min={1} placeholder="Không giới hạn" {...register('perUserLimit')} error={errors.perUserLimit?.message} />
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <Checkbox label="Đang bật" {...register('isActive')} />
          <Checkbox label="Hiển thị công khai trên trang khuyến mãi" {...register('isPublic')} />
        </div>
      </form>
    </Modal>
  )
}
