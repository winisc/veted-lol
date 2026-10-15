import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../errors/AppError'
import { bannedError, banService } from '../../modules/bans/ban.service'
import { verifyToken } from '../utils/jwt'

export interface AuthRequest extends Request {
  userId?: number
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  // EventSource (SSE) não aceita headers, então o token também pode vir na query.
  const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : null
  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken
  if (!token) throw new AppError('Não autenticado.', 401)

  const userId = verifyToken(token)
  if (userId === null) throw new AppError('Sessão inválida ou expirada.', 401)
  // Banido depois de logar: a sessão aberta para de valer na hora.
  if (banService.isUserBanned(userId)) throw bannedError()

  req.userId = userId
  next()
}
