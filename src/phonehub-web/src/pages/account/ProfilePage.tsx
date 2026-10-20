import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { User } from '@/lib/types'
import { formatDate } from '@/lib/format'
import { errorMessage } from '@/lib/hooks'
import { optionalPhone } from '@/lib/validation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Seo } from '@/components/ui/Misc'

const schema = z.object({ fullName: z.string().trim().min(2, 'Họ tên từ 2 ký tự').max(120), phone: optionalPhone })
type Values = z.infer<typeof schema>

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const form = useForm<Values>({ resolver: zodResolver(schema), values: { fullName: user?.fullName ?? '', phone: user?.phone ?? '' } })
  const save = useMutation({
    mutationFn: (v: Values) => api.put<User>('/api/account/profile', { fullName: v.fullName, phone: v.phone || null }),
    onSuccess: u => { setUser(u); toast.success('Đã cập nhật thông tin'); form.reset({ fullName: u.fullName, phone: u.phone ?? '' }) },
    onError: e => toast.error(errorMessage(e)),
  })
  return (
    <div className="card p-6">
      <Seo title="Thông tin cá nhân" />
      <h1 className="text-xl font-bold">Thông tin cá nhân</h1>
      <p className="mb-6 text-sm text-slate-500">Thành viên từ {user && formatDate(user.createdAt)}</p>
      <form onSubmit={form.handleSubmit(v => save.mutate(v))} className="grid max-w-xl gap-4" noValidate>
        <Input label="Email" value={user?.email ?? ''} disabled readOnly hint="Email đăng nhập không thể thay đổi" />
        <Input label="Họ và tên" required {...form.register('fullName')} error={form.formState.errors.fullName?.message} />
        <Input label="Số điện thoại" type="tel" {...form.register('phone')} error={form.formState.errors.phone?.message} />
        <div><Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}>Lưu thay đổi</Button></div>
      </form>
    </div>
  )
}
