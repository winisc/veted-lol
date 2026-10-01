import type { Request, Response } from 'express'
import { AppError } from '../../shared/errors/AppError'
import { parseRiotId } from '../../shared/utils/riotId'
import { riotService } from './riot.service'

export const riotController = {
  async lookup(req: Request, res: Response) {
    const parsed = parseRiotId(req.query.riotId)
    if (!parsed) throw new AppError('Riot ID inválido. Use o formato Nome#TAG.', 400)

    res.json(await riotService.lookup(parsed))
  },
}
