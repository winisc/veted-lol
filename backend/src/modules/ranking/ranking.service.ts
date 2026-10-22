import { AppError } from '../../shared/errors/AppError'
import { matchRepository } from '../matches/match.repository'
import { scoringFor } from '../matches/match.scoring'
import { LEGACY_SEASON_ID } from '../seasons/season.constants'
import { seasonRepository, type Season } from '../seasons/season.repository'
import { seasonService } from '../seasons/season.service'
import { banService } from '../bans/ban.service'
import { isBoard, type Board } from '../../shared/types/modes'
import { buildRanking, type RankingEntry } from './ranking.builder'

export type { RankingEntry }

// Tabela de uma season. Sem argumento, a da season atual (calculada na hora); as encerradas vêm congeladas.
// `board`: a tabela normal (filas 5x5 com draft) ou a de ARAM.
export function getRanking(seasonId?: number, board: Board = 'normal'): RankingEntry[] {
  const current = seasonService.current()
  const id = seasonId ?? current.id
  return id === current.id ? buildRanking(matchRepository.rankingRows(id, board), id) : seasonRepository.standings(id, board)
}

const seasonInfo = (season: Season, currentId: number) => ({
  id: season.id,
  startsAt: season.startsAt,
  endsAt: season.endsAt,
  current: season.id === currentId,
  legacy: season.id === LEGACY_SEASON_ID, // a tabela antiga, de antes das seasons
})

export const rankingService = {
  // `seasonParam` vem da URL (?season=N); sem ele, a season atual. `boardParam` (?board=aram): a tabela de ARAM.
  get(seasonParam?: unknown, boardParam?: unknown) {
    const board: Board = isBoard(boardParam) ? boardParam : 'normal'
    const current = seasonService.current()
    let season: Season | null = current
    if (seasonParam !== undefined && seasonParam !== '') {
      const id = Number(seasonParam)
      if (!Number.isInteger(id) || id < 0) throw new AppError('Season inválida.', 400)
      season = id === current.id ? current : seasonRepository.findById(id)
      if (!season) throw new AppError('Season não encontrada.', 404)
    }

    // Na season atual, cada um vem com a sequência atual (🔥 vitórias / 🧊 derrotas seguidas).
    const ranking = getRanking(season.id, board)
    const banned = banService.bannedUserIds()
    for (const entry of ranking) if (banned.has(entry.userId)) entry.banned = true
    if (season.id === current.id) {
      const streaks = matchRepository.streaks(current.id, board)
      for (const entry of ranking) entry.streak = streaks.get(entry.userId) ?? 0
    }

    return {
      board,
      scoring: scoringFor(season.id), // a pontuação que valia na season mostrada
      ranking,
      season: seasonInfo(season, current.id),
      seasons: seasonService.list().map((s) => seasonInfo(s, current.id)),
      now: Date.now(),
    }
  },
}
