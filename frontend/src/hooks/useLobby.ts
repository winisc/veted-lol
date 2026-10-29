import { useCallback, useEffect, useState } from 'react'
import type { ShownReaction } from '../lib/reactions'
import type { PlayerElo } from '../lib/elo'
import type { PlayerRoles } from '../lib/roles'
import { API_BASE, api, tokenStorage } from '../lib/api'
import { nextSkew } from '../lib/clock'
import type { QueueMode } from '../lib/modes'

export type Side = 'blue' | 'red'
export type MatchOutcome = Side | 'remake'
export type LobbyPhase =
  | 'teams' // ARAM: times sorteados, antes da partida começar
  | 'voting'
  | 'captains'
  | 'coinflip'
  | 'order' // modo tabela: o capitão em 2º na tabela escolhe se pica primeiro ou segundo
  | 'side'
  | 'picking'
  | 'done'
  | 'playing'
  | 'result'
  | 'stats' // capitão vencedor envia o print do placar e confere os números
  | 'mvp'
  | 'bagre'
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
  rankPosition: number | null // posição na tabela quando o lobby abriu (null = sem partidas)
  rankPoints?: number | null // pontos na season atual (null = sem partidas; ausente em servidores antigos)
  streak?: number // sequência quando o lobby abriu (+ vitórias, - derrotas seguidas)
  roles?: PlayerRoles // roles do perfil (ausente em servidores antigos)
  elo?: PlayerElo | null // elo do LoL (null = sem rank; ausente em servidores antigos)
}

export interface Pick {
  playerId: number
  byId: number
  order: number
  auto?: boolean // o último restante, que entrou sozinho no time
}

export interface DraftSnapshot {
  firstPickId: number | null
  orderChooserId?: number | null
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
  bagreCandidates: number[]
  bagreVotedCount: number
  myBagreVote: number | null
  bagreCounts: Record<number, number> | null
  bagreId: number | null
  statsUploaderId?: number | null // capitão vencedor: quem envia o print do placar (ausente em servidores antigos)
  gameStats?: PlayerGameStats[] | null // números de cada jogador, do print (null = pulado / ainda não enviado)
  gameNumber: number
  rematchVotes: number
  iVotedRematch: boolean
  rematchAvailable: boolean
}

// Números de um jogador na partida, do print do placar.
export interface PlayerGameStats {
  userId: number
  champion: string // id do Data Dragon (ex.: "MonkeyKing")
  kills: number
  deaths: number
  assists: number
  cs: number | null
  gold: number | null
  damage: number | null
}

// O que a leitura do print conseguiu tirar (null = não leu; o capitão preenche na conferência).
export interface StatsDraft {
  read: boolean
  note?: string
  rows: { [K in keyof PlayerGameStats]: K extends 'userId' ? number : PlayerGameStats[K] | null }[]
}

export interface LobbySnapshot {
  id: string
  mode: QueueMode
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
  reaction?: ShownReaction
}

const REACTION_MS = 3500 // quanto tempo cada reação fica na tela

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
  const [reactions, setReactions] = useState<ShownReaction[]>([])

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) return

    const source = new EventSource(`${API_BASE}/lobby/events?access_token=${encodeURIComponent(token)}`)
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as LobbyEvent
      setConnected(true)
      setState((s) => ({ lobby: data.lobby, notice: data.notice, skew: data.lobby ? nextSkew(s.lobby ? s.skew : null, data.lobby.now) : 0 }))
      // Reação de alguém do lobby: fica alguns segundos na tela e some sozinha.
      const reaction = data.reaction
      if (reaction) {
        setReactions((list) => [...list.slice(-7), reaction])
        window.setTimeout(() => setReactions((list) => list.filter((r) => r.id !== reaction.id)), REACTION_MS)
      }
    }

    return () => source.close()
  }, [])

  // Ação do jogador (votar, escolher lado, fazer pick...). O servidor também avisa todos pelo canal SSE.
  const act = useCallback(async (path: string, body: unknown) => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ lobby: LobbySnapshot }>(path, { body })
      setState((s) => ({ ...s, lobby: data.lobby, skew: nextSkew(s.lobby ? s.skew : null, data.lobby.now) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setBusy(false)
    }
  }, [])

  const vote = useCallback((targetId: number) => act('/lobby/vote', { targetId }), [act])
  const chooseOrder = useCallback((first: boolean) => act('/lobby/order', { first }), [act])
  const chooseSide = useCallback((side: Side) => act('/lobby/side', { side }), [act])
  const pick = useCallback((playerId: number) => act('/lobby/pick', { playerId }), [act])
  const voteEnd = useCallback((value: boolean) => act('/lobby/end', { vote: value }), [act])
  const voteResult = useCallback((choice: MatchOutcome) => act('/lobby/result', { choice }), [act])
  const voteMvp = useCallback((targetId: number) => act('/lobby/mvp', { targetId }), [act])
  const voteBagre = useCallback((targetId: number) => act('/lobby/bagre', { targetId }), [act])
  // Print do placar: o capitão vencedor confirma os números conferidos, ou pula.
  const submitStats = useCallback((rows: PlayerGameStats[]) => act('/lobby/stats', { rows }), [act])
  const skipStats = useCallback(() => act('/lobby/stats/skip', {}), [act])
  // Reação rápida: sem "carregando" nem mensagem de erro (se vier rápido demais, só não aparece).
  const react = useCallback(async (reaction: string) => {
    try {
      await api('/lobby/react', { body: { reaction } })
    } catch {
      // ignorado
    }
  }, [])
  const voteRematch = useCallback((value: boolean) => act('/lobby/rematch', { vote: value }), [act])

  // Devolve se conseguiu sair (para quem quer emendar outra ação, como entrar na fila de novo).
  const leave = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      await api('/lobby/leave', { method: 'POST' })
      setState({ lobby: null, skew: 0 })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
      setBusy(false)
      return false
    }
  }, [])

  return {
    ...state,
    connected,
    busy,
    error,
    vote,
    chooseOrder,
    chooseSide,
    pick,
    voteEnd,
    voteResult,
    voteMvp,
    voteBagre,
    submitStats,
    skipStats,
    voteRematch,
    leave,
    reactions,
    react,
  }
}
