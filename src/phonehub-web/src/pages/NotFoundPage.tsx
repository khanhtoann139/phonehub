import { ButtonLink } from '@/components/ui/Button'
import { Seo } from '@/components/ui/Misc'

export default function NotFoundPage() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <Seo title="Không tìm thấy trang" />
      <div>
        <p className="bg-gradient-to-br from-brand-500 to-brand-800 bg-clip-text text-8xl font-extrabold text-transparent">404</p>
        <h1 className="mt-2 text-2xl font-bold">Không tìm thấy trang</h1>
        <p className="mt-2 text-slate-500">Trang bạn tìm có thể đã bị di chuyển hoặc không tồn tại.</p>
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink to="/">Về trang chủ</ButtonLink>
          <ButtonLink to="/dien-thoai" variant="outline">Xem điện thoại</ButtonLink>
        </div>
      </div>
    </div>
  )
}
