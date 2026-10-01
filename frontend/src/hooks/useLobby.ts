import { useCallback, useEffect, useState } from 'react'
import { api, tokenStorage } from '../lib/api'

export type Side = 'blue' | 'red'
export type MatchOutcome = Side | 'remake'
export type LobbyPhase =
  | 'voting'
  | 'captains'
  | 'coinflip'
  | 'side'
  | 'picking'
  | 'done'
  | 'playing'
  | 'result'
  | 'mvp'
  | 'finished'
  | 'rematch'

export interface LobbyPlayer {
  id: number
  riotId: string
  iconId: number
  isYou: boolean
  hasVoted: boolean
  votes: number | null
  isCaptain: boolean
  team: Side | null
}

export interface Pick {
  playerId: number
  byId: number
  order: number
}

export interface DraftSnapshot {
  firstPickId: number | null
  sideChooserId: number | null
  sides: { blue: number | null; red: number | null }
  currentTurnId: number | null
  turnPicksLeft: number
  pickIndex: number
  totalPicks: number
  picks: Pick[]
}

export interface MatchSnapshot {
  startedAt: number | null
  endedAt: number | null
  votesNeeded: number
  endVotes: number
  iVotedEnd: boolean
  resultCounts: Record<MatchOutcome, number>
  myResultVote: MatchOutcome | null
  outcome: MatchOutcome | null
  mvpCandidates: number[]
  mvpVotedCount: number
  myMvpVote: number | null
  mvpCounts: Record<number, number> | null
  mvpId: number | null
  gameNumber: number
  rematchVotes: number
  iVotedRematch: boolean
  rematchAvailable: boolean
}

export interface LobbySnapshot {
  id: string
  phase: LobbyPhase
  endsAt: number | null
  durationMs: number
  now: number
  players: LobbyPlayer[]
  myVote: number | null
  votedCount: number
  captains: number[]
  draft: DraftSnapshot
  match: MatchSnapshot
}

interface LobbyEvent {
  lobby: LobbySnapshot | null
  notice?: string
}

interface LobbyState {
  lobby: LobbySnapshot | null | undefined // undefined = ainda carregando, null = sem lobby
  notice?: string
  skew: number // servidor - cliente, em ms, para a contagem regressiva bater com o servidor
}

export function useLobby() {
  const [state, setState] = useState<LobbyState>({ lobby: undefined, skew: 0 })
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) return

    const source = new EventSource(`/api/lobby/events?access_token=${encodeURIComponent(token)}`)
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as LobbyEvent
      setConnected(true)
      setState({ lobby: data.lobby, notice: data.notice, skew: data.lobby ? data.lobby.now - Date.now() : 0 })
    }

    return () => source.close()
  }, [])

  // Ação do jogador (votar, escolher lado, fazer pick...). O servidor também avisa todos pelo canal SSE.
  const act = useCallback(async (path: string, body: unknown) => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ lobby: LobbySnapshot }>(path, { body })
      setState((s) => ({ ...s, lobby: data.lobby, skew: data.lobby.now - Date.now() }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setBusy(false)
    }
  }, [])

  const vote = useCallback((targetId: number) => act('/lobby/vote', { targetId }), [act])
  const chooseSide = useCallback((side: Side) => act('/lobby/side', { side }), [act])
  const pick = useCallback((playerId: number) => act('/lobby/pick', { playerId }), [act])
  const voteEnd = useCallback((value: boolean) => act('/lobby/end', { vote: value }), [act])
  const voteResult = useCallback((choice: MatchOutcome) => act('/lobby/result', { choice }), [act])
  const voteMvp = useCallback((targetId: number) => act('/lobby/mvp', { targetId }), [act])
  const voteRematch = useCallback((value: boolean) => act('/lobby/rematch', { vote: value }), [act])

  const leave = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      await api('/lobby/leave', { method: 'POST' })
      setState({ lobby: null, skew: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
      setBusy(false)
    }
  }, [])

  return {
    ...state,
    connected,
    busy,
    error,
    vote,
    chooseSide,
    pick,
    voteEnd,
    voteResult,
    voteMvp,
    voteRematch,
    leave,
  }
}
