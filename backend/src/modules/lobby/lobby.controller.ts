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

  confirm(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.confirmTeams(req.userId!) })
  },

  ban(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.ban(req.userId!, req.body?.champion) })
  },

  trade(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.requestTrade(req.userId!, req.body?.targetId) })
  },

  tradeAnswer(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.answerTrade(req.userId!, req.body?.fromId, req.body?.accept) })
  },

  tradeCancel(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.cancelTrade(req.userId!) })
  },

  hover(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.hoverChampion(req.userId!, req.body?.champion ?? null) })
  },

  champion(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.pickChampion(req.userId!, req.body?.champion) })
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

  async statsScreenshot(req: AuthRequest, res: Response) {
    const image = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    res.json({ draft: await lobbyService.readStatsScreenshot(req.userId!, image) })
  },

  stats(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.submitStats(req.userId!, req.body) })
  },

  skipStats(req: AuthRequest, res: Response) {
    res.json({ lobby: lobbyService.skipStats(req.userId!) })
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
