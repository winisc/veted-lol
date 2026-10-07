import { AppError } from '../../shared/errors/AppError'
import { isRole, type PlayerRoles, type Role } from '../../shared/types/roles'
import { formatRiotId } from '../../shared/utils/riotId'
import { matchRepository } from '../matches/match.repository'
import type { Rival } from '../matches/match.types'
import { computePoints, matchPoints, scoringFor, winRate } from '../matches/match.scoring'
import { getRanking } from '../ranking/ranking.service'
import { LEGACY_SEASON_ID } from '../seasons/season.constants'
import { seasonRepository } from '../seasons/season.repository'
import { seasonService } from '../seasons/season.service'
import { userRepository } from '../users/user.repository'

const HISTORY_LIMIT = 20
const SEASONS_SHOWN = 12 // a atual e as mais recentes encerradas

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

// Quem mais aparece nas vitórias e quem mais aparece nas derrotas do jogador, dentre um grupo de pessoas
// (adversários ou parceiros). Só conta quem jogou pelo menos 2 partidas com/contra ele e só se o saldo
// for claramente de um lado.
const MIN_GAMES_TOGETHER = 2

function bestAndWorst(all: Rival[]) {
  const played = all.filter((r) => r.wins + r.losses >= MIN_GAMES_TOGETHER)
  const best = played
    .filter((r) => r.wins > r.losses)
    .sort((a, b) => b.wins - b.losses - (a.wins - a.losses) || b.wins - a.wins)[0]
  const worst = played
    .filter((r) => r.losses > r.wins)
    .sort((a, b) => b.losses - b.wins - (a.losses - a.wins) || b.losses - a.losses)[0]
  return { best: best ?? null, worst: worst ?? null }
}

// "Freguês" é quem o jogador mais vence e "carrasco" é quem mais vence o jogador (times opostos).
function rivals(userId: number) {
  const { best, worst } = bestAndWorst(matchRepository.headToHead(userId))
  return { victim: best, nemesis: worst }
}

// Duos: o parceiro com quem o jogador mais ganha e o parceiro com quem mais perde (mesmo time).
function duos(userId: number) {
  return bestAndWorst(matchRepository.withTeammates(userId))
}

export const profileService = {
  get(userId: number) {
    const user = userRepository.findById(userId)
    if (!user) throw new AppError('Usuário não encontrado.', 404)

    // Pontos, posição e números do perfil são da season atual; a posição em cada season vem em `seasons`.
    const season = seasonService.current()
    const stats = matchRepository.statsForUser(userId, season.id)
    const ranking = getRanking(season.id)
    const entry = ranking.find((e) => e.userId === userId)
    const seasons = seasonService.list().slice(0, SEASONS_SHOWN).map((s) => {
      const row = s.id === season.id ? entry : seasonRepository.standings(s.id).find((e) => e.userId === userId)
      return {
        id: s.id,
        current: s.id === season.id,
        legacy: s.id === LEGACY_SEASON_ID,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        position: row?.position ?? null, // null: não jogou nessa season
        zone: row?.zone ?? null,
        points: row?.points ?? null,
        games: row?.games ?? null,
        rankedPlayers: s.id === season.id ? ranking.length : seasonRepository.standings(s.id).length,
      }
    })
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
        points: computePoints(stats, season.id),
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
      season: { id: season.id, startsAt: season.startsAt, endsAt: season.endsAt, now: Date.now() },
      seasons,
      extra: {
        captain: {
          ...captain,
          winRate: winRate(captain.wins, captain.games - captain.wins),
        },
        streaks: streaks(matchRepository.resultsForUser(userId)),
        rivals: rivals(userId),
        duos: duos(userId),
      },
      history: matchRepository.historyForUser(userId, HISTORY_LIMIT).map((match) => ({
        ...match,
        points: matchPoints(match.result, match.isMvp, match.isBagre, match.seasonId),
      })),
      scoring: scoringFor(season.id),
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
