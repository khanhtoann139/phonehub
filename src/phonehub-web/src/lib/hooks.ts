import { useEffect, useState, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { api, ApiError } from './api'
import { useAuth } from './auth'
import type { Cart } from './types'

export function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra, vui lòng thử lại')

/** Chuyển tới trang đăng nhập (kèm đường quay lại) nếu chưa đăng nhập. Trả về true nếu đã đăng nhập. */
export function useRequireLogin() {
  const { status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  return (message = 'Vui lòng đăng nhập để tiếp tục') => {
    if (status === 'authenticated') return true
    toast.info(message)
    navigate(`/dang-nhap?next=${encodeURIComponent(location.pathname + location.search)}`)
    return false
  }
}

// ───────────── Giỏ hàng (server-side) ─────────────
export function useCart() {
  const { status } = useAuth()
  return useQuery({ queryKey: ['cart'], queryFn: () => api.get<Cart>('/api/cart'), enabled: status === 'authenticated', staleTime: 10_000 })
}

export function useAddToCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { variantId: number; quantity: number }) => api.post<Cart>('/api/cart/items', v),
    onSuccess: cart => { qc.setQueryData(['cart'], cart); toast.success('Đã thêm vào giỏ hàng') },
    onError: e => toast.error(errorMessage(e)),
  })
}

// ───────────── Wishlist ─────────────
export function useWishlistIds() {
  const { status } = useAuth()
  return useQuery({ queryKey: ['wishlist', 'ids'], queryFn: () => api.get<number[]>('/api/wishlist/ids'), enabled: status === 'authenticated' })
}

export function useToggleWishlist() {
  const qc = useQueryClient()
  const requireLogin = useRequireLogin()
  const ids = useWishlistIds().data ?? []
  const m = useMutation({
    mutationFn: async (productId: number) => {
      const has = ids.includes(productId)
      if (has) await api.del(`/api/wishlist/${productId}`)
      else await api.post(`/api/wishlist/${productId}`)
      return !has
    },
    onSuccess: added => {
      toast.success(added ? 'Đã thêm vào yêu thích' : 'Đã bỏ khỏi yêu thích')
      qc.invalidateQueries({ queryKey: ['wishlist'] })
    },
    onError: e => toast.error(errorMessage(e)),
  })
  return {
    isWished: (id: number) => ids.includes(id),
    toggle: (id: number) => { if (requireLogin('Đăng nhập để lưu sản phẩm yêu thích')) m.mutate(id) },
    pending: m.isPending,
  }
}

// ───────────── Danh sách so sánh (trạng thái giao diện, lưu cục bộ trên trình duyệt) ─────────────
export interface CompareEntry { id: number; name: string; imageUrl?: string | null }
const COMPARE_KEY = 'ph_compare'
const listeners = new Set<() => void>()
let compareCache: CompareEntry[] = readCompare()

function readCompare(): CompareEntry[] {
  try { return JSON.parse(localStorage.getItem(COMPARE_KEY) ?? '[]') } catch { return [] }
}
function writeCompare(list: CompareEntry[]) {
  compareCache = list
  try { localStorage.setItem(COMPARE_KEY, JSON.stringify(list)) } catch { /* private mode */ }
  listeners.forEach(l => l())
}

export function useCompare() {
  const list = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => compareCache)
  return {
    list,
    has: (id: number) => list.some(x => x.id === id),
    toggle: (p: CompareEntry) => {
      if (list.some(x => x.id === p.id)) return writeCompare(list.filter(x => x.id !== p.id))
      if (list.length >= 4) { toast.warning('Chỉ so sánh tối đa 4 sản phẩm'); return }
      writeCompare([...list, p])
      toast.success('Đã thêm vào so sánh')
    },
    remove: (id: number) => writeCompare(list.filter(x => x.id !== id)),
    clear: () => writeCompare([]),
  }
}
