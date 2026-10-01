import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, tokenStorage } from '../lib/api'

export interface User {
  id: number
  riotId: string
  iconId: number
  isAdmin: boolean
}

interface AuthResponse {
  token: string
  user: User
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (riotId: string, password: string) => Promise<void>
  register: (riotId: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStorage.get() !== null)

  useEffect(() => {
    if (!tokenStorage.get()) return
    api<{ user: User }>('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false))
  }, [])

  const authenticate = useCallback(async (path: string, riotId: string, password: string) => {
    const data = await api<AuthResponse>(path, { body: { riotId, password } })
    tokenStorage.set(data.token)
    setUser(data.user)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: (riotId, password) => authenticate('/auth/login', riotId, password),
      register: (riotId, password) => authenticate('/auth/register', riotId, password),
      logout: () => {
        tokenStorage.clear()
        setUser(null)
      },
    }),
    [user, loading, authenticate],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
