import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { optionalPhone, passwordSchema } from '@/lib/validation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Seo } from '@/components/ui/Misc'
import { Logo } from '@/components/layout/Header'

const loginSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})
const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên từ 2 ký tự').max(120),
  email: z.string().trim().email('Email không hợp lệ').max(190),
  phone: optionalPhone,
  password: passwordSchema,
  confirm: z.string(),
}).refine(v => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' })

type LoginValues = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>

/** Chỉ cho phép quay lại đường dẫn nội bộ (chống open redirect). */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/')

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { status, login, register } = useAuth()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const next = safeNext(sp.get('next'))
  const isLogin = mode === 'login'

  const form = useForm<LoginValues & Partial<RegisterValues>>({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema) as never,
    defaultValues: { email: '', password: '', fullName: '', phone: '', confirm: '' },
  })
  const err = form.formState.errors

  if (status === 'authenticated') return <Navigate to={next} replace />

  const onSubmit = form.handleSubmit(async v => {
    try {
      const user = isLogin
        ? await login(v.email, v.password)
        : await register({ email: v.email, password: v.password, fullName: v.fullName!, phone: v.phone || undefined })
      toast.success(isLogin ? `Chào mừng trở lại, ${user.fullName}!` : 'Tạo tài khoản thành công!')
      navigate(user.role === 'admin' && next === '/' ? '/admin' : next, { replace: true })
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [k, msgs] of Object.entries(e.fieldErrors)) form.setError(k as keyof LoginValues, { message: msgs[0] })
        if (e.code === 'email_taken') form.setError('email', { message: e.message })
        toast.error(e.message)
      } else toast.error('Không thể kết nối máy chủ')
    }
  })

  return (
    <div className="container-page grid min-h-[70vh] items-center gap-10 py-10 lg:grid-cols-2">
      <Seo title={isLogin ? 'Đăng nhập' : 'Đăng ký tài khoản'} />
      <div className="hidden lg:block">
        <h2 className="text-4xl font-extrabold leading-tight">Mua sắm điện thoại<br /><span className="text-brand-600">an tâm hơn</span> cùng PhoneHub</h2>
        <ul className="mt-6 space-y-3 text-slate-600">
          {['Theo dõi đơn hàng mọi lúc', 'Lưu sản phẩm yêu thích & giỏ hàng trên mọi thiết bị', 'Nhận mã ưu đãi dành riêng cho thành viên'].map(t => (
            <li key={t} className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand-600" />{t}</li>
          ))}
        </ul>
      </div>
      <div className="card mx-auto w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex justify-center lg:hidden"><Logo /></div>
        <h1 className="text-2xl font-bold">{isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <Link to={`${isLogin ? '/dang-ky' : '/dang-nhap'}${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand-700 hover:underline">
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </Link>
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {!isLogin && <Input label="Họ và tên" required autoComplete="name" {...form.register('fullName')} error={err.fullName?.message} />}
          <Input label="Email" required type="email" autoComplete="email" {...form.register('email')} error={err.email?.message} />
          {!isLogin && <Input label="Số điện thoại" type="tel" autoComplete="tel" {...form.register('phone')} error={err.phone?.message} />}
          <Input label="Mật khẩu" required type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} {...form.register('password')} error={err.password?.message}
            hint={isLogin ? undefined : 'Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số'} />
          {!isLogin && <Input label="Nhập lại mật khẩu" required type="password" autoComplete="new-password" {...form.register('confirm')} error={err.confirm?.message} />}
          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>{isLogin ? 'Đăng nhập' : 'Đăng ký'}</Button>
        </form>
      </div>
    </div>
  )
}
