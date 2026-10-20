import type { AuthResponse } from './types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  status: number
  code?: string
  fieldErrors: Record<string, string[]>
  constructor(status: number, message: string, code?: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

// Access token chỉ nằm trong bộ nhớ (không localStorage) → giảm rủi ro XSS đánh cắp token.
// Refresh token nằm trong cookie HttpOnly do server đặt.
let accessToken: string | null = null
let refreshing: Promise<AuthResponse | null> | null = null
const authListeners = new Set<(auth: AuthResponse | null) => void>()

export const tokenStore = {
  get: () => accessToken,
  set: (t: string | null) => { accessToken = t },
  onChange: (fn: (auth: AuthResponse | null) => void) => { authListeners.add(fn); return () => { authListeners.delete(fn) } },
}

type Query = Record<string, string | number | boolean | null | undefined>
interface Options { method?: string; body?: unknown; query?: Query; signal?: AbortSignal; skipRefresh?: boolean }

export function buildQuery(query?: Query) {
  if (!query) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function parseError(res: Response): Promise<ApiError> {
  let message = res.status === 429 ? 'Bạn thao tác quá nhanh, vui lòng thử lại sau' : `Lỗi ${res.status}`
  let code: string | undefined
  let fieldErrors: Record<string, string[]> = {}
  try {
    const body = await res.json()
    message = body.title ?? body.detail ?? message
    code = body.code
    if (body.errors) {
      fieldErrors = Object.fromEntries(Object.entries(body.errors as Record<string, string[]>).map(([k, v]) => [k.charAt(0).toLowerCase() + k.slice(1), v]))
      const first = Object.values(fieldErrors)[0]?.[0]
      if (first) message = first
    }
  } catch { /* body không phải JSON */ }
  return new ApiError(res.status, message, code, fieldErrors)
}

async function raw<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-PhoneHub-Client': 'web' }
  const isForm = opts.body instanceof FormData
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let res: Response
  try {
    res = await fetch(`${BASE}${path}${buildQuery(opts.query)}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
      credentials: 'include',
      signal: opts.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.')
  }

  if (res.status === 401 && !opts.skipRefresh && accessToken) {
    const renewed = await refreshSession()
    if (renewed) return raw<T>(path, { ...opts, skipRefresh: true })
  }
  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Đổi refresh cookie lấy access token mới. Gọi đồng thời nhiều nơi → chỉ một request (single-flight). */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= raw<AuthResponse>('/api/auth/refresh', { method: 'POST', skipRefresh: true })
    .then(r => { accessToken = r.accessToken; authListeners.forEach(f => f(r)); return r })
    .catch(() => { accessToken = null; authListeners.forEach(f => f(null)); return null })
    .finally(() => { refreshing = null })
  return refreshing
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => raw<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => raw<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => raw<T>(path, { method: 'PUT', body: body ?? {} }),
  del: <T>(path: string) => raw<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => raw<T>(path, { method: 'POST', body: form }),
}

/** Ảnh do API phục vụ (/images, /uploads) — thêm origin API khi frontend deploy khác domain. */
export function assetUrl(url?: string | null) {
  if (!url) return '/favicon.svg'
  return url.startsWith('/') ? `${BASE}${url}` : url
}
