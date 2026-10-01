import type { Response } from 'express'
import type { AuthRequest } from '../../shared/middlewares/auth.middleware'
import { adminService } from './admin.service'

const idParam = (req: AuthRequest) => String(req.params.id)
const numericId = (req: AuthRequest) => Number(req.params.id)

export const adminController = {
  live(_req: AuthRequest, res: Response) {
    res.json(adminService.live())
  },

  removeFromQueue(req: AuthRequest, res: Response) {
    adminService.removeFromQueue(req.body?.userId)
    res.json({ ok: true })
  },

  clearQueue(_req: AuthRequest, res: Response) {
    res.json(adminService.clearQueue())
  },

  cancelLobby(req: AuthRequest, res: Response) {
    adminService.cancelLobby(idParam(req))
    res.json({ ok: true })
  },

  forceResult(req: AuthRequest, res: Response) {
    adminService.forceResult(idParam(req), req.body?.outcome)
    res.json({ ok: true })
  },

  matches(_req: AuthRequest, res: Response) {
    res.json({ matches: adminService.matches() })
  },

  updateMatch(req: AuthRequest, res: Response) {
    adminService.updateMatch(idParam(req), req.body?.outcome)
    res.json({ ok: true })
  },

  deleteMatch(req: AuthRequest, res: Response) {
    adminService.deleteMatch(idParam(req))
    res.json({ ok: true })
  },

  users(_req: AuthRequest, res: Response) {
    res.json({ users: adminService.users() })
  },

  setAdmin(req: AuthRequest, res: Response) {
    adminService.setAdmin(req.userId!, numericId(req), req.body?.isAdmin)
    res.json({ ok: true })
  },

  async resetPassword(req: AuthRequest, res: Response) {
    await adminService.resetPassword(numericId(req), req.body?.password)
    res.json({ ok: true })
  },
}
