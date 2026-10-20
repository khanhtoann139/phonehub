import { NavLink, useParams } from 'react-router'
import { Seo } from '@/components/ui/Misc'
import NotFoundPage from './NotFoundPage'

const POLICIES: Record<string, { title: string; body: { h: string; p?: string; ul?: string[] }[] }> = {
  'bao-hanh': {
    title: 'Chính sách bảo hành',
    body: [
      { h: 'Thời hạn bảo hành', p: 'Tất cả điện thoại bán tại PhoneHub được bảo hành chính hãng 12 tháng tại trung tâm bảo hành ủy quyền của hãng.' },
      { h: 'Điều kiện bảo hành', ul: ['Sản phẩm còn trong thời hạn bảo hành, tem/IMEI nguyên vẹn', 'Lỗi phát sinh do nhà sản xuất', 'Không rơi vỡ, vào nước, can thiệp phần cứng'] },
      { h: 'Quy trình', p: 'Mang máy kèm hóa đơn tới cửa hàng PhoneHub gần nhất hoặc gửi qua đường bưu điện. Thời gian xử lý 7–15 ngày làm việc.' },
    ],
  },
  'doi-tra': {
    title: 'Chính sách đổi trả',
    body: [
      { h: '1 đổi 1 trong 30 ngày', p: 'Đổi máy mới cùng model nếu sản phẩm phát sinh lỗi phần cứng do nhà sản xuất trong 30 ngày đầu.' },
      { h: 'Trả hàng hoàn tiền', ul: ['Trong 7 ngày nếu máy chưa kích hoạt, còn nguyên hộp, phụ kiện', 'Hoàn tiền qua phương thức đã thanh toán trong 3–7 ngày làm việc'] },
    ],
  },
  'giao-hang': {
    title: 'Chính sách giao hàng',
    body: [
      { h: 'Phí giao hàng', p: 'Miễn phí cho đơn từ 2.000.000₫. Đơn dưới mức này phí cố định 30.000₫ toàn quốc.' },
      { h: 'Thời gian', ul: ['Nội thành TP.HCM, Hà Nội: giao nhanh 2 giờ', 'Tỉnh thành khác: 2–4 ngày làm việc'] },
      { h: 'Kiểm tra hàng', p: 'Khách được kiểm tra ngoại quan sản phẩm trước khi thanh toán (với đơn COD).' },
    ],
  },
  'bao-mat': {
    title: 'Chính sách bảo mật thông tin',
    body: [
      { h: 'Thông tin thu thập', p: 'Họ tên, email, số điện thoại, địa chỉ giao hàng — chỉ dùng để xử lý đơn hàng và chăm sóc khách hàng.' },
      { h: 'Bảo vệ dữ liệu', ul: ['Mật khẩu được băm một chiều (PBKDF2), không ai có thể đọc được', 'PhoneHub không lưu thông tin thẻ thanh toán', 'Kết nối được mã hóa HTTPS'] },
      { h: 'Quyền của bạn', p: 'Bạn có thể cập nhật thông tin cá nhân trong trang Tài khoản hoặc liên hệ CSKH để yêu cầu xóa dữ liệu.' },
    ],
  },
}

export default function PolicyPage() {
  const { slug = '' } = useParams()
  const policy = POLICIES[slug]
  if (!policy) return <NotFoundPage />
  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
      <Seo title={policy.title} />
      <nav aria-label="Chính sách" className="card flex h-fit gap-1 overflow-x-auto p-3 lg:flex-col">
        {Object.entries(POLICIES).map(([k, v]) => (
          <NavLink key={k} to={`/chinh-sach/${k}`} className={({ isActive }) => `shrink-0 rounded-xl px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>{v.title}</NavLink>
        ))}
      </nav>
      <article className="card prose-ph p-6 sm:p-8">
        <h1 className="mb-4 text-2xl font-bold">{policy.title}</h1>
        {policy.body.map(s => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p && <p>{s.p}</p>}
            {s.ul && <ul>{s.ul.map(li => <li key={li}>{li}</li>)}</ul>}
          </section>
        ))}
      </article>
    </div>
  )
}
