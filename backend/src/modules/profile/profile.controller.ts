import type { Response } from 'express'
import type { AuthRequest } from '../../shared/middlewares/auth.middleware'
import { profileService } from './profile.service'

export const profileController = {
  me(req: AuthRequest, res: Response) {
    res.json(profileService.get(req.userId!))
  },

  // Perfil de outro jogador (mesmos dados do próprio perfil).
  byId(req: AuthRequest, res: Response) {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Jogador inválido.' })
      return
    }
    res.json(profileService.get(id))
  },

  setRoles(req: AuthRequest, res: Response) {
    res.json({ roles: profileService.setRoles(req.userId!, req.body) })
  },
}
