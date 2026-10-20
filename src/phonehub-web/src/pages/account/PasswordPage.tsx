import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/hooks'
import { passwordSchema } from '@/lib/validation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Seo } from '@/components/ui/Misc'

const schema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: passwordSchema,
  confirm: z.string(),
}).refine(v => v.newPassword === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' })
type Values = z.infer<typeof schema>

export default function PasswordPage() {
  const { logout } = useAuth()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } })
  const err = form.formState.errors
  const save = useMutation({
    mutationFn: (v: Values) => api.post('/api/account/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: async () => {
      toast.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.')
      await logout()
    },
    onError: e => toast.error(errorMessage(e)),
  })
  return (
    <div className="card p-6">
      <Seo title="Đổi mật khẩu" />
      <h1 className="text-xl font-bold">Đổi mật khẩu</h1>
      <p className="mb-6 text-sm text-slate-500">Sau khi đổi, mọi phiên đăng nhập trên thiết bị khác sẽ bị đăng xuất.</p>
      <form onSubmit={form.handleSubmit(v => save.mutate(v))} className="grid max-w-md gap-4" noValidate>
        <Input label="Mật khẩu hiện tại" type="password" autoComplete="current-password" required {...form.register('currentPassword')} error={err.currentPassword?.message} />
        <Input label="Mật khẩu mới" type="password" autoComplete="new-password" required {...form.register('newPassword')} error={err.newPassword?.message} hint="Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số" />
        <Input label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" required {...form.register('confirm')} error={err.confirm?.message} />
        <div><Button type="submit" loading={save.isPending}>Cập nhật mật khẩu</Button></div>
      </form>
    </div>
  )
}
