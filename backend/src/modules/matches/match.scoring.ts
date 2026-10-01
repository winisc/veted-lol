// Sistema de pontuação do ranking. Para mudar o peso de cada resultado, altere só aqui.
// Remake não vale nada. Os pontos são calculados a partir do histórico, então mudar os valores
// recalcula o ranking inteiro retroativamente.
export const scoring = {
  win: 25,
  loss: -15,
  mvp: 5, // bônus por ser MVP (só quem venceu pode ser MVP)
}

export interface WinLossRecord {
  wins: number
  losses: number
  mvps: number
}

export function computePoints({ wins, losses, mvps }: WinLossRecord) {
  return wins * scoring.win + losses * scoring.loss + mvps * scoring.mvp
}

// Pontos ganhos ou perdidos em uma única partida.
export function matchPoints(result: 'win' | 'loss' | 'remake', isMvp: boolean) {
  if (result === 'win') return scoring.win + (isMvp ? scoring.mvp : 0)
  if (result === 'loss') return scoring.loss
  return 0
}

// Porcentagem de vitórias (0-100, uma casa decimal); null se ainda não há vitórias nem derrotas.
export function winRate(wins: number, losses: number): number | null {
  const total = wins + losses
  return total === 0 ? null : Math.round((wins / total) * 1000) / 10
}
