import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, refreshSession, tokenStore } from './api'
import type { AuthResponse, User } from './types'

type Status = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  user: User | null
  status: Status
  login: (email: string, password: string) => Promise<User>
  register: (data: { email: string; password: string; fullName: string; phone?: string }) => Promise<User>
  logout: () => Promise<void>
  setUser: (u: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const qc = useQueryClient()

  const apply = useCallback((auth: AuthResponse | null) => {
    tokenStore.set(auth?.accessToken ?? null)
    setUser(auth?.user ?? null)
    setStatus(auth ? 'authenticated' : 'anonymous')
  }, [])

  // Khôi phục phiên khi tải trang bằng refresh cookie.
  useEffect(() => {
    const off = tokenStore.onChange(a => { if (!a) { setUser(null); setStatus('anonymous') } })
    refreshSession().then(apply)
    return off
  }, [apply])

  // Làm mới access token trước khi hết hạn (15 phút).
  useEffect(() => {
    if (status !== 'authenticated') return
    const id = window.setInterval(() => refreshSession().then(a => a && setUser(a.user)), 12 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [status])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    login: async (email, password) => {
      const res = await api.post<AuthResponse>('/api/auth/login', { email, password })
      apply(res)
      await qc.invalidateQueries()
      return res.user
    },
    register: async data => {
      const res = await api.post<AuthResponse>('/api/auth/register', data)
      apply(res)
      await qc.invalidateQueries()
      return res.user
    },
    logout: async () => {
      try { await api.post('/api/auth/logout') } finally {
        apply(null)
        qc.clear()
      }
    },
    setUser,
  }), [user, status, apply, qc])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
