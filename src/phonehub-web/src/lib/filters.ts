/** Bộ lọc danh sách sản phẩm ⇄ URL search params (chia sẻ link giữ nguyên bộ lọc). */
export interface ProductFilters {
  q: string
  brand: string[]
  storage: string[]
  ram: string[]
  minPrice?: number
  maxPrice?: number
  sort: string
  page: number
  featured: boolean
  onSale: boolean
}

export const SORTS = [
  { value: 'popular', label: 'Phổ biến' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price_asc', label: 'Giá thấp → cao' },
  { value: 'price_desc', label: 'Giá cao → thấp' },
  { value: 'rating', label: 'Đánh giá cao' },
]

export const PRICE_RANGES = [
  { label: 'Dưới 5 triệu', min: undefined, max: 5_000_000 },
  { label: '5 – 10 triệu', min: 5_000_000, max: 10_000_000 },
  { label: '10 – 20 triệu', min: 10_000_000, max: 20_000_000 },
  { label: '20 – 30 triệu', min: 20_000_000, max: 30_000_000 },
  { label: 'Trên 30 triệu', min: 30_000_000, max: undefined },
] as const

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])
const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined)

export function parseFilters(sp: URLSearchParams): ProductFilters {
  const sort = sp.get('sort') ?? 'popular'
  return {
    q: sp.get('q') ?? '',
    brand: list(sp.get('brand')),
    storage: list(sp.get('storage')),
    ram: list(sp.get('ram')),
    minPrice: num(sp.get('minPrice')),
    maxPrice: num(sp.get('maxPrice')),
    sort: SORTS.some(s => s.value === sort) ? sort : 'popular',
    page: Math.max(1, num(sp.get('page')) ?? 1),
    featured: sp.get('featured') === 'true',
    onSale: sp.get('onSale') === 'true',
  }
}

export function toSearchParams(f: Partial<ProductFilters>): URLSearchParams {
  const sp = new URLSearchParams()
  if (f.q) sp.set('q', f.q)
  if (f.brand?.length) sp.set('brand', f.brand.join(','))
  if (f.storage?.length) sp.set('storage', f.storage.join(','))
  if (f.ram?.length) sp.set('ram', f.ram.join(','))
  if (f.minPrice !== undefined) sp.set('minPrice', String(f.minPrice))
  if (f.maxPrice !== undefined) sp.set('maxPrice', String(f.maxPrice))
  if (f.sort && f.sort !== 'popular') sp.set('sort', f.sort)
  if (f.page && f.page > 1) sp.set('page', String(f.page))
  if (f.featured) sp.set('featured', 'true')
  if (f.onSale) sp.set('onSale', 'true')
  return sp
}

export const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
