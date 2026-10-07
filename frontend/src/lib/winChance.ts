import type { LobbyPlayer } from '../hooks/useLobby'
import type { PlayerElo } from './elo'

// Chance estimada de vitória de cada time, pelo elo do LoL e pelos pontos na tabela da season.
// É só uma estimativa (força média de cada time comparada com a fórmula de Elo), não uma previsão garantida.
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER']
const DIVISION: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 }
const APEX_FROM = TIERS.indexOf('MASTER')

const DEFAULT_ELO = 3 * 400 // sem elo (unranked ou sem a Riot): conta como Ouro IV
const ELO_SPREAD = 600 // diferença de elo médio para 10x de chance (400 = um tier inteiro, ~82%)
const TABLE_SPREAD = 150 // diferença de pontos médios na tabela para 10x de chance (75 pontos, ~3 vitórias, dá ~76%)

function eloScore(elo: PlayerElo | null | undefined): number | null {
  if (!elo) return null
  const tier = TIERS.indexOf(elo.tier)
  if (tier < 0) return null
  // Do Ferro ao Diamante: 400 por elo, 100 por divisão e o PDL da divisão. Mestre para cima: só o PDL conta a mais.
  if (tier < APEX_FROM) return tier * 400 + (DIVISION[elo.rank] ?? 0) * 100 + Math.min(elo.leaguePoints, 100)
  return tier * 400 + elo.leaguePoints / 2
}

const average = (team: LobbyPlayer[], value: (p: LobbyPlayer) => number) =>
  team.reduce((sum, p) => sum + value(p), 0) / team.length

// Fórmula de Elo: chance do azul pela diferença entre as médias.
const logistic = (blue: number, red: number, spread: number) => 1 / (1 + 10 ** ((red - blue) / spread))

// Chance do time azul (0 a 1). Elo do LoL e tabela da season pesam igual (metade cada); se só um dos dois tem dados
// (ninguém com elo, ou ninguém jogou na season), vale só o que tem. `informed` = havia algum dado.
export function winChance(blue: LobbyPlayer[], red: LobbyPlayer[]) {
  const everyone = [...blue, ...red]
  const hasElo = everyone.some((p) => eloScore(p.elo) !== null)
  const hasTable = everyone.some((p) => (p.rankPoints ?? 0) !== 0)

  const eloValue = (p: LobbyPlayer) => eloScore(p.elo) ?? DEFAULT_ELO
  const tableValue = (p: LobbyPlayer) => p.rankPoints ?? 0 // sem partidas na season = 0 pontos
  const byElo = logistic(average(blue, eloValue), average(red, eloValue), ELO_SPREAD)
  const byTable = logistic(average(blue, tableValue), average(red, tableValue), TABLE_SPREAD)

  const chance = hasElo && hasTable ? (byElo + byTable) / 2 : hasElo ? byElo : hasTable ? byTable : 0.5
  return { blue: Math.min(0.95, Math.max(0.05, chance)), informed: hasElo || hasTable }
}
