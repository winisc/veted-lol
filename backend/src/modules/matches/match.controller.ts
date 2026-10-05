import type { Request, Response } from 'express'
import { matchService } from './match.service'

export const matchController = {
  get(req: Request, res: Response) {
    res.json(matchService.get(String(req.params.id)))
  },
}
