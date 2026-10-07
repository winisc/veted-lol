import type { Request, Response } from 'express'
import { rankingService } from './ranking.service'

export const rankingController = {
  list(req: Request, res: Response) {
    res.json(rankingService.get(req.query.season))
  },
}
