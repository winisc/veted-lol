import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { API_BASE, api, tokenStorage } from '../lib/api'
import type { QueueMode } from '../lib/modes'

export interface ReadyCheckInfo {
  endsAt: number
  durationMs: number
  now: number
  accepted: number
  total: number
  iAccepted: boolean
}

export interface QueueSnapshot {
  // ready_check = a fila fechou e o jogador precisa aceitar a partida
  status: 'idle' | 'queued' | 'ready_check' | 'matched'
  mode: QueueMode | null // fila (ou confirmação) em que o jogador está
  size: number // jogadores na fila do modo do jogador
  sizes: Record<QueueMode, number> // quantos esperam em cada fila
  required: number
  players: { riotId: string; iconId: number; isYou: boolean }[]
  readyCheck: ReadyCheckInfo | null
  notice?: string
}

interface QueueContextValue {
  snapshot: QueueSnapshot | null
  skew: number // servidor - cliente, em ms, para a contagem da confirmação bater com o servidor
  connected: boolean
  busy: boolean
  error: string
  notice: string // aviso do servidor (ex.: saiu da fila por não aceitar) até o jogador fechar
  clearNotice: () => void
  join: (mode: QueueMode) => Promise<void>
  leave: () => Promise<void>
  accept: () => Promise<void>
  decline: () => Promise<void>
}

const QueueContext = createContext<QueueContextValue | null>(null)

// A conexão com a fila vive no layout (e não em uma página), para continuar aberta quando o jogador
// troca de aba. Se ela fechasse, o servidor tiraria o jogador da fila depois de alguns segundos.
export function QueueProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null)
  const [skew, setSkew] = useState(0)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const receive = useCallback((data: QueueSnapshot) => {
    setSnapshot(data)
    if (data.readyCheck) setSkew(data.readyCheck.now - Date.now())
    if (data.notice) setNotice(data.notice)
  }, [])

  // O servidor envia o estado da fila a cada mudança (SSE). O EventSource reconecta sozinho.
  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) return

    const source = new EventSource(`${API_BASE}/queue/events?access_token=${encodeURIComponent(token)}`)
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = (event) => {
      setConnected(true)
      receive(JSON.parse(event.data) as QueueSnapshot)
    }

    return () => source.close()
  }, [receive])

  const run = useCallback(
    async (path: string, body?: unknown) => {
      setBusy(true)
      setError('')
      if (path === '/queue/join') setNotice('')
      try {
        receive(await api<QueueSnapshot>(path, { method: 'POST', body }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro inesperado.')
      } finally {
        setBusy(false)
      }
    },
    [receive],
  )

  const value = useMemo<QueueContextValue>(
    () => ({
      snapshot,
      skew,
      connected,
      busy,
      error,
      notice,
      clearNotice: () => setNotice(''),
      join: (mode) => run('/queue/join', { mode }),
      leave: () => run('/queue/leave'),
      accept: () => run('/queue/accept'),
      decline: () => run('/queue/decline'),
    }),
    [snapshot, skew, connected, busy, error, notice, run],
  )

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
}

export function useQueue() {
  const ctx = useContext(QueueContext)
  if (!ctx) throw new Error('useQueue deve ser usado dentro de QueueProvider')
  return ctx
}
