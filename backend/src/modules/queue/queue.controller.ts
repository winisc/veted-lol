import type { Request, Response } from 'express'
import type { AuthRequest } from '../../shared/middlewares/auth.middleware'
import { queueService } from './queue.service'

export const queueController = {
  join(req: AuthRequest, res: Response) {
    res.json(queueService.join(req.userId!, req.body?.mode ?? 'vote'))
  },

  leave(req: AuthRequest, res: Response) {
    res.json(queueService.leave(req.userId!))
  },

  accept(req: AuthRequest, res: Response) {
    res.json(queueService.accept(req.userId!))
  },

  decline(req: AuthRequest, res: Response) {
    res.json(queueService.decline(req.userId!))
  },

  events(req: Request, res: Response) {
    queueService.subscribe((req as AuthRequest).userId!, req, res)
  },
}
