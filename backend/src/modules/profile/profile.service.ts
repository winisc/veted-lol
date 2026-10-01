import { AppError } from '../../shared/errors/AppError'
import { formatRiotId } from '../../shared/utils/riotId'
import { matchRepository } from '../matches/match.repository'
import { computePoints, matchPoints, scoring, winRate } from '../matches/match.scoring'
import { getRanking } from '../ranking/ranking.service'
import { userRepository } from '../users/user.repository'

const HISTORY_LIMIT = 20

export const profileService = {
  get(userId: number) {
    const user = userRepository.findById(userId)
    if (!user) throw new AppError('Usuário não encontrado.', 404)

    const stats = matchRepository.statsForUser(userId)
    const ranking = getRanking()
    const entry = ranking.find((e) => e.userId === userId)

    return {
      user: {
        id: user.id,
        riotId: formatRiotId(user.gameName, user.tagLine),
        iconId: user.iconId,
        createdAt: user.createdAt,
      },
      stats: {
        points: computePoints(stats),
        games: stats.games,
        wins: stats.wins,
        losses: stats.losses,
        winRate: winRate(stats.wins, stats.losses),
        mvps: stats.mvps,
        rank: entry?.position ?? null, // null enquanto não jogou nenhuma partida válida
        zone: entry?.zone ?? null,
        rankedPlayers: ranking.length,
      },
      history: matchRepository.historyForUser(userId, HISTORY_LIMIT).map((match) => ({
        ...match,
        points: matchPoints(match.result, match.isMvp),
      })),
      scoring,
    }
  },
}
