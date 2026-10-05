import type { Request, Response } from 'express'
import type { AuthRequest } from '../../shared/middlewares/auth.middleware'
import { authService } from './auth.service'

export const authController = {
  async register(req: Request, res: Response) {
    const { riotId, password } = req.body ?? {}
    res.status(201).json(await authService.register(riotId, password))
  },

  async login(req: Request, res: Response) {
    const { riotId, password } = req.body ?? {}
    res.json(await authService.login(riotId, password))
  },

  async changePassword(req: AuthRequest, res: Response) {
    const { currentPassword, newPassword } = req.body ?? {}
    await authService.changePassword(req.userId!, currentPassword, newPassword)
    res.json({ ok: true })
  },

  me(req: AuthRequest, res: Response) {
    res.json({ user: authService.me(req.userId!) })
  },
}
