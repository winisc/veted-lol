import { LEGACY_SEASON_ID } from '../seasons/season.constants'

// Sistema de pontuação do ranking. Os pontos são calculados a partir do histórico de cada season.
// Remake não vale nada. A pontuação mudou na primeira season semanal: a tabela antiga (até a season 6) continua
// valendo -15 por derrota e +5 de MVP; da season 7 em diante a derrota vale -17 e o MVP +3. Para mudar de novo só nas seasons futuras,
// crie outro conjunto abaixo e escolha em `scoringFor`.
export interface Scoring {
  win: number
  loss: number
  mvp: number // bônus por ser MVP (só quem venceu pode ser MVP)
  bagre: number // desconto por ser o bagre (só quem perdeu pode ser bagre)
}

const legacyScoring: Scoring = { win: 25, loss: -15, mvp: 5, bagre: -2 }
export const scoring: Scoring = { win: 25, loss: -17, mvp: 3, bagre: -2 }

// Pontuação que valia na season (e continua valendo para as tabelas já encerradas).
export function scoringFor(seasonId: number): Scoring {
  return seasonId <= LEGACY_SEASON_ID ? legacyScoring : scoring
}

export interface WinLossRecord {
  wins: number
  losses: number
  mvps: number
  bagres: number
}

export function computePoints({ wins, losses, mvps, bagres }: WinLossRecord, seasonId: number) {
  const rules = scoringFor(seasonId)
  return wins * rules.win + losses * rules.loss + mvps * rules.mvp + bagres * rules.bagre
}

// Pontos ganhos ou perdidos em uma única partida (de acordo com a season dela).
export function matchPoints(result: 'win' | 'loss' | 'remake', isMvp: boolean, isBagre: boolean, seasonId: number) {
  const rules = scoringFor(seasonId)
  if (result === 'win') return rules.win + (isMvp ? rules.mvp : 0)
  if (result === 'loss') return rules.loss + (isBagre ? rules.bagre : 0)
  return 0
}

// Porcentagem de vitórias (0-100, uma casa decimal); null se ainda não há vitórias nem derrotas.
export function winRate(wins: number, losses: number): number | null {
  const total = wins + losses
  return total === 0 ? null : Math.round((wins / total) * 1000) / 10
}
