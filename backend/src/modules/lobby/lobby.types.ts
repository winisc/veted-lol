import type { MatchOutcome, Side } from '../matches/match.types'

export type { MatchOutcome, Side }

// voting -> captains (resultado) -> coinflip -> side (perdedor escolhe) -> picking -> done (breve)
//   -> playing (partida em andamento) -> result (votação do vencedor) -> mvp -> finished
//   -> rematch (contagem, se 6 votarem para jogar novamente) -> playing (lados trocados)
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
  | 'rematch' // contagem antes da revanche: avisa que os times vão trocar de lado

export interface LobbyPlayer {
  userId: number
  riotId: string
  iconId: number
}

export interface Pick {
  playerId: number
  byId: number // capitão que escolheu
  order: number // 1, 2, 3...
}

export interface Lobby {
  id: string
  players: LobbyPlayer[]
  phase: LobbyPhase
  votes: Map<number, number> // votação de capitães: quem votou -> em quem votou
  endsAt: number | null // fim da fase atual (ms desde epoch)
  durationMs: number // duração total da fase atual
  captains: number[] // userIds dos capitães, do mais votado para o menos
  firstPickId: number | null // capitão que ganhou o sorteio
  sideChooserId: number | null // capitão que perdeu o sorteio e escolhe o lado
  sides: Partial<Record<Side, number>> // lado -> capitão
  teams: Record<Side, number[]> // userIds de cada time (capitão primeiro)
  pickOrder: number[] // capitão de cada pick, em ordem
  pickIndex: number
  picks: Pick[]
  // Partida
  startedAt: number | null
  endedAt: number | null // quando o fim da partida foi declarado
  endVotes: Set<number> // quem votou para encerrar a partida
  resultVotes: Map<number, MatchOutcome> // quem votou -> em qual resultado
  outcome: MatchOutcome | null
  mvpVotes: Map<number, number> // quem votou -> em quem votou
  mvpId: number | null
  matchId: string // id da partida no histórico; muda a cada revanche
  gameNumber: number // 1 = primeira partida do lobby; sobe a cada "jogar novamente"
  rematchVotes: Set<number> // quem votou para jogar novamente
  left: Set<number> // quem saiu do lobby depois de a partida terminar
  createdAt: number
}

export interface DraftSnapshot {
  firstPickId: number | null
  sideChooserId: number | null
  sides: { blue: number | null; red: number | null }
  currentTurnId: number | null // quem precisa agir agora (escolher o lado ou fazer um pick)
  turnPicksLeft: number // picks seguidos que o capitão da vez ainda tem, contando o atual
  pickIndex: number
  totalPicks: number
  picks: Pick[]
}

export interface MatchSnapshot {
  startedAt: number | null
  endedAt: number | null
  votesNeeded: number // votos necessários para encerrar a partida e para decidir o resultado
  endVotes: number
  iVotedEnd: boolean
  resultCounts: Record<MatchOutcome, number>
  myResultVote: MatchOutcome | null
  outcome: MatchOutcome | null
  mvpCandidates: number[] // jogadores do time vencedor
  mvpVotedCount: number
  myMvpVote: number | null
  mvpCounts: Record<number, number> | null // só depois do fim da votação de MVP
  mvpId: number | null
  gameNumber: number
  rematchVotes: number
  iVotedRematch: boolean
  rematchAvailable: boolean // false se alguém já saiu do lobby (a revanche precisa dos 10)
}

// O que cada jogador recebe. Os votos de capitão e de MVP só aparecem depois do fim da votação.
export interface LobbySnapshot {
  id: string
  phase: LobbyPhase
  endsAt: number | null
  durationMs: number
  now: number // hora do servidor, para o cliente acertar o relógio da contagem
  players: {
    id: number
    riotId: string
    iconId: number
    isYou: boolean
    hasVoted: boolean
    votes: number | null
    isCaptain: boolean
    team: Side | null
  }[]
  myVote: number | null
  votedCount: number
  captains: number[]
  draft: DraftSnapshot
  match: MatchSnapshot
}

export interface LobbyEvent {
  lobby: LobbySnapshot | null
  notice?: string
}
