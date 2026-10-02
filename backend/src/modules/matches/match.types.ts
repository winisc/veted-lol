import type { QueueMode } from '../../shared/types/modes'

export type Side = 'blue' | 'red'
export type MatchOutcome = Side | 'remake'
export type PlayerResult = 'win' | 'loss' | 'remake'

export interface NewMatch {
  id: string
  mode: QueueMode
  startedAt: number
  endedAt: number
  outcome: MatchOutcome
  mvpId: number | null
  bagreId: number | null
  players: { userId: number; side: Side; isCaptain: boolean }[]
}

// Contagem de partidas de um jogador. Remakes não entram.
export interface PlayerStats {
  games: number
  wins: number
  losses: number
  mvps: number
  bagres: number
}

export interface RankingRow extends PlayerStats {
  userId: number
  gameName: string
  tagLine: string
  profileIconId: number | null
}

export interface HistoryRow {
  matchId: string
  endedAt: string
  durationSeconds: number
  side: Side
  result: PlayerResult
  isCaptain: boolean
  isMvp: boolean
  isBagre: boolean
}

// ---- Admin ----

export interface AdminMatchPlayerRow {
  userId: number
  gameName: string | null
  tagLine: string | null
  profileIconId: number | null
  side: Side
  isCaptain: number
  result: PlayerResult
}

export interface AdminMatch {
  id: string
  mode: QueueMode
  startedAt: string
  endedAt: string
  durationSeconds: number
  outcome: MatchOutcome
  mvpId: number | null
  bagreId: number | null
  players: {
    userId: number
    riotId: string
    iconId: number
    side: Side
    isCaptain: boolean
    result: PlayerResult
  }[]
}
