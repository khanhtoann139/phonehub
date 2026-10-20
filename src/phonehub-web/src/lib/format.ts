import type { OrderStatus } from './types'

const vnd = new Intl.NumberFormat('vi-VN')
export const formatPrice = (n: number) => `${vnd.format(Math.round(n))}₫`
export const formatNumber = (n: number) => vnd.format(n)
export const formatDate = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
export const formatDateTime = (s: string) => new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const storageLabel = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`)
export const discountPercent = (price: number, compare?: number | null) => (compare && compare > price ? Math.round((1 - price / compare) * 100) : 0)

/** Rút gọn giá: 12.990.000 → "12,99 tr" (dùng cho trục biểu đồ). */
export const compactPrice = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`
    : n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
      : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  AwaitingPayment: { label: 'Chờ thanh toán', tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  Pending: { label: 'Chờ xác nhận', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  Confirmed: { label: 'Đã xác nhận', tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  Shipping: { label: 'Đang giao', tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  Delivered: { label: 'Đã giao', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  Cancelled: { label: 'Đã hủy', tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
}

export const PAYMENT_STATUS: Record<string, string> = {
  Unpaid: 'Chưa thanh toán', Pending: 'Đang chờ', Paid: 'Đã thanh toán', Failed: 'Thất bại', Refunded: 'Đã hoàn tiền',
}

export const PAYMENT_METHOD: Record<string, string> = { cod: 'COD', sandbox: 'Sandbox', vnpay: 'VNPay' }
