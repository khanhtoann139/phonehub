import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/hooks'
import { optionalPhone } from '@/lib/validation'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import { Seo } from '@/components/ui/Misc'

const schema = z.object({
  name: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(120),
  email: z.string().trim().email('Email không hợp lệ'),
  phone: optionalPhone,
  subject: z.string().trim().min(3, 'Tiêu đề tối thiểu 3 ký tự').max(200),
  message: z.string().trim().min(10, 'Nội dung tối thiểu 10 ký tự').max(4000),
})
type Values = z.infer<typeof schema>

export default function ContactPage() {
  const { user } = useAuth()
  const form = useForm<Values>({ resolver: zodResolver(schema), values: { name: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '', subject: '', message: '' } })
  const err = form.formState.errors
  const send = useMutation({
    mutationFn: (v: Values) => api.post<{ message: string }>('/api/contact', { ...v, phone: v.phone || undefined }),
    onSuccess: r => { toast.success(r.message); form.reset({ ...form.getValues(), subject: '', message: '' }) },
    onError: e => toast.error(errorMessage(e)),
  })

  return (
    <div className="container-page py-8">
      <Seo title="Liên hệ" description="Liên hệ PhoneHub — hotline 1800 6868, hỗ trợ 8h–22h mỗi ngày." />
      <h1 className="text-2xl font-bold sm:text-3xl">Liên hệ PhoneHub</h1>
      <p className="mt-1 text-slate-500">Chúng tôi luôn sẵn sàng hỗ trợ bạn.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={form.handleSubmit(v => send.mutate(v))} className="card grid gap-4 p-6 sm:grid-cols-2" noValidate>
          <Input label="Họ tên" required {...form.register('name')} error={err.name?.message} />
          <Input label="Email" required type="email" {...form.register('email')} error={err.email?.message} />
          <Input label="Số điện thoại" type="tel" {...form.register('phone')} error={err.phone?.message} />
          <Input label="Tiêu đề" required {...form.register('subject')} error={err.subject?.message} />
          <Textarea label="Nội dung" required wrapperClassName="sm:col-span-2" className="min-h-36" {...form.register('message')} error={err.message?.message} />
          <div className="sm:col-span-2"><Button type="submit" loading={send.isPending}>Gửi liên hệ</Button></div>
        </form>
        <aside className="card h-fit space-y-4 p-6 text-sm">
          {[
            [Phone, 'Hotline', '1800 6868 (miễn phí)'],
            [Mail, 'Email', 'cskh@phonehub.local'],
            [MapPin, 'Cửa hàng', '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh'],
            [Clock, 'Giờ làm việc', '8:00 – 22:00, tất cả các ngày'],
          ].map(([I, t, d]) => {
            const Icon = I as typeof Phone
            return (
              <div key={t as string} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></span>
                <div><p className="font-semibold">{t as string}</p><p className="text-slate-600">{d as string}</p></div>
              </div>
            )
          })}
        </aside>
      </div>
    </div>
  )
}
