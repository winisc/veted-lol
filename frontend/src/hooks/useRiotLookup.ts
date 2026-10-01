import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { isValidRiotIdFormat } from '../lib/riotId'

export interface PlayerProfile {
  riotId: string
  gameName: string
  tagLine: string
  profileIconId: number
  summonerLevel: number
  iconUrl: string
}

export type RiotLookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; player: PlayerProfile }
  | { status: 'notfound'; message: string }
  | { status: 'unavailable'; message: string }

const DEBOUNCE_MS = 600

export function useRiotLookup(riotId: string, enabled: boolean): RiotLookupState {
  const [state, setState] = useState<RiotLookupState>({ status: 'idle' })

  useEffect(() => {
    const value = riotId.trim()
    if (!enabled || !isValidRiotIdFormat(value)) {
      setState({ status: 'idle' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })

    const timer = setTimeout(() => {
      api<PlayerProfile>(`/riot/lookup?riotId=${encodeURIComponent(value)}`)
        .then((player) => {
          if (!cancelled) setState({ status: 'found', player })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          const message = err instanceof Error ? err.message : 'Erro inesperado.'
          const notFound = err instanceof ApiError && err.status === 404
          setState(notFound ? { status: 'notfound', message } : { status: 'unavailable', message })
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [riotId, enabled])

  return state
}
