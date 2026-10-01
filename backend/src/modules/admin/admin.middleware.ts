import type { NextFunction, Response } from 'express'
import { AppError } from '../../shared/errors/AppError'
import type { AuthRequest } from '../../shared/middlewares/auth.middleware'
import { userRepository } from '../users/user.repository'

// Usar depois do requireAuth: só deixa passar quem é admin (no banco ou no ADMIN_RIOT_IDS do .env).
export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  const user = req.userId ? userRepository.findById(req.userId) : null
  if (!user?.isAdmin) throw new AppError('Acesso restrito a administradores.', 403)
  next()
}
