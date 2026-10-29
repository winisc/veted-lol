import bcrypt from 'bcryptjs'
import { AppError } from '../../shared/errors/AppError'
import { signToken } from '../../shared/utils/jwt'
import { formatRiotId, parseRiotId, type RiotId } from '../../shared/utils/riotId'
import { bannedError, banService } from '../bans/ban.service'
import { lobbyRepository } from '../lobby/lobby.repository'
import { queueRepository } from '../queue/queue.repository'
import { riotService } from '../riot/riot.service'
import { userRepository } from '../users/user.repository'
import type { PublicUser, User } from '../users/user.types'

export interface AuthResult {
  token: string
  user: PublicUser
}

function toPublicUser(user: User): PublicUser {
  return { id: user.id, riotId: formatRiotId(user.gameName, user.tagLine), iconId: user.iconId, isAdmin: user.isAdmin }
}

// Atualiza o ícone de invocador com o atual da Riot, sem atrasar o login (falhas são ignoradas).
function refreshIconInBackground(user: User) {
  if (!riotService.isConfigured()) return
  riotService
    .lookup({ gameName: user.gameName, tagLine: user.tagLine })
    .then((profile) => {
      if (profile.profileIconId !== user.iconId) userRepository.updateIcon(user.id, profile.profileIconId)
    })
    .catch(() => {})
}

export const authService = {
  async register(riotId: unknown, password: unknown): Promise<AuthResult> {
    const parsed = parseRiotId(riotId)
    if (!parsed) throw new AppError('Riot ID inválido. Use o formato Nome#TAG.', 400)
    if (banService.isRiotIdBanned(parsed)) throw bannedError()
    if (typeof password !== 'string' || password.length < 6) {
      throw new AppError('A senha precisa ter no mínimo 6 caracteres.', 400)
    }

    // Com a chave da Riot configurada, só aceita contas que existem e guarda a grafia oficial.
    const profile = riotService.isConfigured() ? await riotService.lookup(parsed) : null
    const account = profile ? { gameName: profile.gameName, tagLine: profile.tagLine } : parsed

    if (banService.isRiotIdBanned(account)) throw bannedError()
    if (userRepository.findByRiotId(account)) throw new AppError('Esse Riot ID já está cadastrado.', 409)

    const user = userRepository.create(account, await bcrypt.hash(password, 10), profile?.profileIconId ?? null)
    return { token: signToken(user.id), user: toPublicUser(user) }
  },

  async login(riotId: unknown, password: unknown): Promise<AuthResult> {
    const invalid = new AppError('Riot ID ou senha incorretos.', 401)

    const parsed = parseRiotId(riotId)
    if (!parsed || typeof password !== 'string') throw invalid

    const user = userRepository.findByRiotId(parsed)
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw invalid
    // Banido: só avisa depois da senha certa (não entrega quem está banido para quem chuta senha).
    if (banService.isUserBanned(user.id)) throw bannedError()

    refreshIconInBackground(user)
    return { token: signToken(user.id), user: toPublicUser(user) }
  },

  // Troca a senha de quem está logado, pedindo a senha atual.
  async changePassword(userId: number, currentPassword: unknown, newPassword: unknown) {
    const user = userRepository.findById(userId)
    if (!user) throw new AppError('Usuário não encontrado.', 401)
    if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError('A senha atual está incorreta.', 400)
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new AppError('A nova senha precisa ter no mínimo 6 caracteres.', 400)
    }
    if (newPassword === currentPassword) throw new AppError('A nova senha precisa ser diferente da atual.', 400)

    userRepository.setPassword(userId, await bcrypt.hash(newPassword, 10))
  },

  // Troca de nick (o jogador mudou o Riot ID no LoL). Pede a senha e confere: formato, se não é de outra conta daqui,
  // se não está banido e, com a chave da Riot, se a conta existe e é a MESMA conta da Riot (mesmo puuid).
  async changeRiotId(userId: number, riotId: unknown, password: unknown): Promise<PublicUser> {
    const user = userRepository.findById(userId)
    if (!user) throw new AppError('Usuário não encontrado.', 401)
    if (typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError('A senha está incorreta.', 400)
    }
    const parsed = parseRiotId(riotId)
    if (!parsed) throw new AppError('Riot ID inválido. Use o formato Nome#TAG.', 400)
    // Nome guardado na fila e no lobby: só troca fora deles.
    if (
      lobbyRepository.findByUser(userId) ||
      queueRepository.modeOf(userId) ||
      queueRepository.standbyModeOf(userId) ||
      queueRepository.findReadyCheck(userId)
    ) {
      throw new AppError('Saia da fila e da partida para trocar o nick.', 409)
    }

    let account: RiotId = parsed
    let puuid: string | null = null
    let iconId: number | null = null
    if (riotService.isConfigured()) {
      const profile = await riotService.lookup(parsed)
      account = { gameName: profile.gameName, tagLine: profile.tagLine }
      iconId = profile.profileIconId
      puuid = await riotService.puuidOf(account)
      if (user.puuid) {
        if (user.puuid !== puuid) throw new AppError('Esse Riot ID é de outra conta da Riot. Use o novo nick da sua conta.', 400)
      } else {
        // Conta antiga sem puuid guardado: se o nick antigo ainda existe na Riot, ele tem que ser a mesma conta.
        const oldPuuid = await riotService.puuidOf(user).catch((err: unknown) => {
          if (err instanceof AppError && err.status === 404) return null // nick antigo não existe mais (foi trocado)
          throw err
        })
        if (oldPuuid && oldPuuid !== puuid) throw new AppError('Esse Riot ID é de outra conta da Riot. Use o novo nick da sua conta.', 400)
        const owner = userRepository.findByPuuid(puuid)
        if (owner && owner.id !== userId) throw new AppError('Essa conta da Riot já está cadastrada.', 409)
      }
    }

    if (account.gameName === user.gameName && account.tagLine === user.tagLine) throw new AppError('Esse já é o seu nick.', 400)
    if (banService.isRiotIdBanned(account)) throw new AppError('Esse Riot ID está banido.', 403)
    const other = userRepository.findByRiotId(account)
    if (other && other.id !== userId) throw new AppError('Esse Riot ID já está cadastrado.', 409)

    userRepository.setRiotId(userId, account)
    if (puuid) userRepository.setPuuid(userId, puuid)
    if (iconId !== null) userRepository.updateIcon(userId, iconId)
    return toPublicUser(userRepository.findById(userId)!)
  },

  me(userId: number): PublicUser {
    const user = userRepository.findById(userId)
    if (!user) throw new AppError('Usuário não encontrado.', 401)
    return toPublicUser(user)
  },
}
