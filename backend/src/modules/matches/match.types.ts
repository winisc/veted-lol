import type { QueueMode } from '../../shared/types/modes'

export type Side = 'blue' | 'red'
export type MatchOutcome = Side | 'remake'
export type PlayerResult = 'win' | 'loss' | 'remake'
export type VoteKind = 'mvp' | 'bagre'

export interface MatchVote {
  kind: VoteKind
  voterId: number
  targetId: number
}

export interface NewMatch {
  id: string
  mode: QueueMode
  seasonId: number // season em que a partida conta
  startedAt: number
  endedAt: number
  outcome: MatchOutcome
  mvpId: number | null
  bagreId: number | null
  players: { userId: number; side: Side; isCaptain: boolean; pickOrder: number | null; pickedBy: number | null }[]
  votes: MatchVote[] // votos de MVP e bagre, guardados para auditoria do admin
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
  seasonId: number
}

// ---- Detalhe da partida e estatísticas ----

export interface MatchDetail {
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
    pickOrder: number | null // em que pick foi escolhido (null: capitão ou partida sem draft salvo)
    pickedBy: number | null // capitão que escolheu
    mvpVotes: number
    bagreVotes: number
  }[]
  hasVotes: boolean // se a contagem de votos foi guardada (partidas antigas não têm)
}

export interface Rival {
  userId: number
  riotId: string
  iconId: number
  wins: number
  losses: number
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
  votes: MatchVote[]
  players: {
    userId: number
    riotId: string
    iconId: number
    side: Side
    isCaptain: boolean
    result: PlayerResult
  }[]
}
