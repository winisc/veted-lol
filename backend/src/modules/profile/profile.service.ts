import { AppError } from '../../shared/errors/AppError'
import { isRole, type PlayerRoles, type Role } from '../../shared/types/roles'
import { formatRiotId } from '../../shared/utils/riotId'
import { matchRepository } from '../matches/match.repository'
import { computePoints, matchPoints, scoring, winRate } from '../matches/match.scoring'
import { getRanking } from '../ranking/ranking.service'
import { userRepository } from '../users/user.repository'

const HISTORY_LIMIT = 20

// Sequências de resultados (do mais recente para o mais antigo, sem remakes).
function streaks(results: ('win' | 'loss')[]) {
  let current: { type: 'win' | 'loss' | null; count: number } = { type: null, count: 0 }
  if (results.length > 0) {
    const type = results[0]
    let count = 0
    while (count < results.length && results[count] === type) count++
    current = { type, count }
  }

  let bestWin = 0
  let worstLoss = 0
  let run = 0
  let runType: 'win' | 'loss' | null = null
  for (const result of results) {
    run = result === runType ? run + 1 : 1
    runType = result
    if (result === 'win') bestWin = Math.max(bestWin, run)
    else worstLoss = Math.max(worstLoss, run)
  }
  return { current, bestWin, worstLoss }
}

// Adversários: o "freguês" é quem o jogador mais vence e o "carrasco" é quem mais vence o jogador.
// Só conta quem já enfrentou pelo menos 2 vezes e só se o saldo for claramente de um lado.
const MIN_GAMES_AGAINST = 2

function rivals(userId: number) {
  const all = matchRepository.headToHead(userId).filter((r) => r.wins + r.losses >= MIN_GAMES_AGAINST)
  const victim = all
    .filter((r) => r.wins > r.losses)
    .sort((a, b) => b.wins - b.losses - (a.wins - a.losses) || b.wins - a.wins)[0]
  const nemesis = all
    .filter((r) => r.losses > r.wins)
    .sort((a, b) => b.losses - b.wins - (a.losses - a.wins) || b.losses - a.losses)[0]
  return { victim: victim ?? null, nemesis: nemesis ?? null }
}

export const profileService = {
  get(userId: number) {
    const user = userRepository.findById(userId)
    if (!user) throw new AppError('Usuário não encontrado.', 404)

    const stats = matchRepository.statsForUser(userId)
    const ranking = getRanking()
    const entry = ranking.find((e) => e.userId === userId)
    const captain = matchRepository.captainStats(userId)

    return {
      user: {
        id: user.id,
        riotId: formatRiotId(user.gameName, user.tagLine),
        iconId: user.iconId,
        createdAt: user.createdAt,
        roles: user.roles,
      },
      stats: {
        points: computePoints(stats),
        games: stats.games,
        wins: stats.wins,
        losses: stats.losses,
        winRate: winRate(stats.wins, stats.losses),
        mvps: stats.mvps,
        bagres: stats.bagres,
        rank: entry?.position ?? null, // null enquanto não jogou nenhuma partida válida
        zone: entry?.zone ?? null,
        rankedPlayers: ranking.length,
      },
      extra: {
        captain: {
          ...captain,
          winRate: winRate(captain.wins, captain.games - captain.wins),
        },
        streaks: streaks(matchRepository.resultsForUser(userId)),
        rivals: rivals(userId),
      },
      history: matchRepository.historyForUser(userId, HISTORY_LIMIT).map((match) => ({
        ...match,
        points: matchPoints(match.result, match.isMvp, match.isBagre),
      })),
      scoring,
    }
  },

  // Define as roles do jogador: as três são obrigatórias e não podem repetir.
  setRoles(userId: number, body: unknown): PlayerRoles {
    const input = (body ?? {}) as Record<string, unknown>
    const read = (key: string): Role => {
      const value = input[key]
      if (value === undefined || value === null) throw new AppError('Escolha a role principal, a secundária e a que empena.', 400)
      if (!isRole(value)) throw new AppError('Role inválida.', 400)
      return value
    }
    const roles: PlayerRoles = { main: read('main'), secondary: read('secondary'), worst: read('worst') }
    if (new Set([roles.main, roles.secondary, roles.worst]).size !== 3) throw new AppError('Escolha roles diferentes para cada campo.', 400)

    userRepository.setRoles(userId, roles)
    return roles
  },
}
