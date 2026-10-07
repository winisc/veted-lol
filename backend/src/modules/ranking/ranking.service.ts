import { AppError } from '../../shared/errors/AppError'
import { matchRepository } from '../matches/match.repository'
import { scoringFor } from '../matches/match.scoring'
import { LEGACY_SEASON_ID } from '../seasons/season.constants'
import { seasonRepository, type Season } from '../seasons/season.repository'
import { seasonService } from '../seasons/season.service'
import { buildRanking, type RankingEntry } from './ranking.builder'

export type { RankingEntry }

// Tabela de uma season. Sem argumento, a da season atual (calculada na hora); as encerradas vêm congeladas.
export function getRanking(seasonId?: number): RankingEntry[] {
  const current = seasonService.current()
  const id = seasonId ?? current.id
  return id === current.id ? buildRanking(matchRepository.rankingRows(id), id) : seasonRepository.standings(id)
}

const seasonInfo = (season: Season, currentId: number) => ({
  id: season.id,
  startsAt: season.startsAt,
  endsAt: season.endsAt,
  current: season.id === currentId,
  legacy: season.id === LEGACY_SEASON_ID, // a tabela antiga, de antes das seasons
})

export const rankingService = {
  // `seasonParam` vem da URL (?season=N); sem ele, a season atual.
  get(seasonParam?: unknown) {
    const current = seasonService.current()
    let season: Season | null = current
    if (seasonParam !== undefined && seasonParam !== '') {
      const id = Number(seasonParam)
      if (!Number.isInteger(id) || id < 0) throw new AppError('Season inválida.', 400)
      season = id === current.id ? current : seasonRepository.findById(id)
      if (!season) throw new AppError('Season não encontrada.', 404)
    }

    return {
      scoring: scoringFor(season.id), // a pontuação que valia na season mostrada
      ranking: getRanking(season.id),
      season: seasonInfo(season, current.id),
      seasons: seasonService.list().map((s) => seasonInfo(s, current.id)),
      now: Date.now(),
    }
  },
}
