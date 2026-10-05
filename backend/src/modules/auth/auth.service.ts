import bcrypt from 'bcryptjs'
import { AppError } from '../../shared/errors/AppError'
import { signToken } from '../../shared/utils/jwt'
import { formatRiotId, parseRiotId } from '../../shared/utils/riotId'
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
    if (typeof password !== 'string' || password.length < 6) {
      throw new AppError('A senha precisa ter no mínimo 6 caracteres.', 400)
    }

    // Com a chave da Riot configurada, só aceita contas que existem e guarda a grafia oficial.
    const profile = riotService.isConfigured() ? await riotService.lookup(parsed) : null
    const account = profile ? { gameName: profile.gameName, tagLine: profile.tagLine } : parsed

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

  me(userId: number): PublicUser {
    const user = userRepository.findById(userId)
    if (!user) throw new AppError('Usuário não encontrado.', 401)
    return toPublicUser(user)
  },
}
