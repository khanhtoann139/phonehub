import { useSearchParams } from 'react-router'
import { CheckCircle2, XCircle } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Seo } from '@/components/ui/Misc'

/** Backend xử lý & xác thực callback rồi mới redirect về đây — trang này chỉ hiển thị kết quả. */
export default function PaymentResultPage() {
  const [sp] = useSearchParams()
  const ok = sp.get('status') === 'success'
  const order = sp.get('order')
  const message = sp.get('message')
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-10">
      <Seo title={ok ? 'Thanh toán thành công' : 'Thanh toán chưa thành công'} />
      <div className="card w-full max-w-md p-8 text-center">
        {ok ? <CheckCircle2 className="mx-auto size-16 text-emerald-500" aria-hidden /> : <XCircle className="mx-auto size-16 text-rose-500" aria-hidden />}
        <h1 className="mt-4 text-2xl font-bold">{ok ? 'Thanh toán thành công!' : 'Thanh toán chưa thành công'}</h1>
        {message && <p className="mt-2 text-slate-600">{message}</p>}
        {order && <p className="mt-1 text-sm text-slate-500">Mã đơn hàng: <b className="text-ink">{order}</b></p>}
        <div className="mt-6 flex flex-col gap-2">
          {order && <ButtonLink to={`/tai-khoan/don-hang/${order}`}>{ok ? 'Xem đơn hàng' : 'Thử thanh toán lại'}</ButtonLink>}
          <ButtonLink to="/" variant="ghost">Về trang chủ</ButtonLink>
        </div>
      </div>
    </div>
  )
}
