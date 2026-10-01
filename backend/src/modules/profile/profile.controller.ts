import type { Response } from 'express'
import type { AuthRequest } from '../../shared/middlewares/auth.middleware'
import { profileService } from './profile.service'

export const profileController = {
  me(req: AuthRequest, res: Response) {
    res.json(profileService.get(req.userId!))
  },
}
