import { resolveIconId } from '../../shared/utils/icons'
import { formatRiotId } from '../../shared/utils/riotId'
import { computePoints, winRate } from '../matches/match.scoring'
import type { RankingRow } from '../matches/match.types'
import { zoneFor, type Zone } from './ranking.zones'

export interface RankingEntry {
  position: number
  zone: Zone
  userId: number
  riotId: string
  iconId: number
  points: number
  games: number
  wins: number
  losses: number
  winRate: number | null
  mvps: number
  bagres: number
}

// Ordem: mais pontos, depois melhor win rate, mais vitórias, mais MVPs, menos bagres e, por fim, nome.
export function buildRanking(rows: RankingRow[], seasonId: number): RankingEntry[] {
  return rows
    .map((row) => ({
      userId: row.userId,
      riotId: formatRiotId(row.gameName, row.tagLine),
      iconId: resolveIconId(row.userId, row.profileIconId),
      points: computePoints(row, seasonId),
      games: row.games,
      wins: row.wins,
      losses: row.losses,
      winRate: winRate(row.wins, row.losses),
      mvps: row.mvps,
      bagres: row.bagres,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        (b.winRate ?? -1) - (a.winRate ?? -1) ||
        b.wins - a.wins ||
        b.mvps - a.mvps ||
        a.bagres - b.bagres ||
        a.riotId.localeCompare(b.riotId),
    )
    .map((entry, i, all) => ({ position: i + 1, zone: zoneFor(i + 1, all.length), ...entry }))
}
