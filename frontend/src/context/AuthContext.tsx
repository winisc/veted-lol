import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, BANNED_EVENT, tokenStorage } from '../lib/api'

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
  updateUser: (user: User) => void // depois de trocar o nick
  kickedMessage: string // aviso para a tela de entrar (ex.: a conta foi banida com a sessão aberta)
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStorage.get() !== null)
  const [kickedMessage, setKickedMessage] = useState('')

  // Banido com a sessão aberta: sai da conta na hora.
  useEffect(() => {
    const onBanned = () => {
      tokenStorage.clear()
      setUser(null)
      setKickedMessage('Esta conta foi banida.')
    }
    window.addEventListener(BANNED_EVENT, onBanned)
    return () => window.removeEventListener(BANNED_EVENT, onBanned)
  }, [])

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
      updateUser: setUser,
      kickedMessage,
    }),
    [user, loading, authenticate, kickedMessage],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
