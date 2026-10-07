import type { Request, Response } from 'express'
import type { AuthRequest } from '../../shared/middlewares/auth.middleware'
import { lobbyService } from './lobby.service'

export const lobbyController = {
  current(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.current(req.userId!) })
  },

  live(_req: AuthRequest, res: Response) {
    res.json({ ...lobbyService.listLive(), now: Date.now() })
  },

  vote(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.vote(req.userId!, req.body?.targetId) })
  },

  react(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.react(req.userId!, req.body?.reaction) })
  },

  order(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.chooseOrder(req.userId!, req.body?.first) })
  },

  side(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.chooseSide(req.userId!, req.body?.side) })
  },

  pick(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.pick(req.userId!, req.body?.playerId) })
  },

  end(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.voteEnd(req.userId!, req.body?.vote) })
  },

  result(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.voteResult(req.userId!, req.body?.choice) })
  },

  mvp(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.voteMvp(req.userId!, req.body?.targetId) })
  },

  bagre(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.voteBagre(req.userId!, req.body?.targetId) })
  },

  rematch(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.voteRematch(req.userId!, req.body?.vote) })
  },

  leave(req: AuthRequest, res: Response) {
    lobbyService.leave(req.userId!)
    res.json({ lobby: null })
  },

  events(req: Request, res: Response) {
    lobbyService.subscribe((req as AuthRequest).userId!, req, res)
  },
}
