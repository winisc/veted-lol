import bcrypt from 'bcryptjs'
import { AppError } from '../../shared/errors/AppError'
import { formatRiotId } from '../../shared/utils/riotId'
import { lobbyService } from '../lobby/lobby.service'
import { matchRepository } from '../matches/match.repository'
import { computePoints, winRate } from '../matches/match.scoring'
import { queueService } from '../queue/queue.service'
import { userRepository } from '../users/user.repository'

const MATCH_LIMIT = 50

export const adminService = {
  // Fila, confirmações e lobbies em andamento.
  live() {
    return {
      queue: queueService.listForAdmin(),
      lobbies: lobbyService.listForAdmin(),
      recentResults: lobbyService.recentResults(),
      now: Date.now(),
    }
  },

  removeFromQueue(userId: unknown) {
    if (typeof userId !== 'number') throw new AppError('Jogador inválido.', 400)
    queueService.adminRemove(userId)
  },

  clearQueue() {
    return { removed: queueService.adminClear() }
  },

  cancelLobby(lobbyId: string) {
    lobbyService.adminCancel(lobbyId)
  },

  forceResult(lobbyId: string, outcome: unknown) {
    lobbyService.adminForceResult(lobbyId, outcome)
  },

  matches() {
    return matchRepository.listRecent(MATCH_LIMIT)
  },

  updateMatch(matchId: string, outcome: unknown) {
    if (outcome !== 'blue' && outcome !== 'red' && outcome !== 'remake') throw new AppError('Resultado inválido.', 400)
    if (!matchRepository.updateOutcome(matchId, outcome)) throw new AppError('Partida não encontrada.', 404)
  },

  deleteMatch(matchId: string) {
    if (!matchRepository.delete(matchId)) throw new AppError('Partida não encontrada.', 404)
  },

  users() {
    return userRepository.listAll().map((user) => {
      const stats = matchRepository.statsForUser(user.id)
      // Carreira inteira: cada season entra com a pontuação da sua época.
      const careerPoints = matchRepository.statsBySeason(user.id).reduce((sum, s) => sum + computePoints(s, s.seasonId), 0)
      return {
        id: user.id,
        riotId: formatRiotId(user.gameName, user.tagLine),
        iconId: user.iconId,
        isAdmin: user.isAdmin,
        adminFromEnv: userRepository.isEnvAdmin(user),
        createdAt: user.createdAt,
        roles: user.roles,
        games: stats.games,
        wins: stats.wins,
        losses: stats.losses,
        mvps: stats.mvps,
        bagres: stats.bagres,
        winRate: winRate(stats.wins, stats.losses),
        points: careerPoints,
      }
    })
  },

  setAdmin(actorId: number, userId: number, isAdmin: unknown) {
    if (typeof isAdmin !== 'boolean') throw new AppError('Valor inválido.', 400)
    const user = userRepository.findById(userId)
    if (!user) throw new AppError('Jogador não encontrado.', 404)
    // Evita trancar o painel: ninguém tira o próprio admin, e admin do .env só sai editando o .env.
    if (!isAdmin && userId === actorId) throw new AppError('Você não pode remover o seu próprio acesso de admin.', 409)
    if (!isAdmin && userRepository.isEnvAdmin(user)) {
      throw new AppError('Esse admin vem do .env (ADMIN_RIOT_IDS). Para remover, tire o Riot ID de lá.', 409)
    }
    userRepository.setAdmin(userId, isAdmin)
  },

  async resetPassword(userId: number, password: unknown) {
    if (typeof password !== 'string' || password.length < 6) {
      throw new AppError('A senha precisa ter no mínimo 6 caracteres.', 400)
    }
    if (!userRepository.findById(userId)) throw new AppError('Jogador não encontrado.', 404)
    userRepository.setPassword(userId, await bcrypt.hash(password, 10))
  },
}
