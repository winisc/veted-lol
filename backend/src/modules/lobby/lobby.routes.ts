import express, { Router } from 'express'
import { requireAuth } from '../../shared/middlewares/auth.middleware'
import { lobbyController } from './lobby.controller'

const lobbyRoutes = Router()

lobbyRoutes.use(requireAuth)

lobbyRoutes.get('/', lobbyController.current)
lobbyRoutes.get('/events', lobbyController.events)
lobbyRoutes.get('/live', lobbyController.live)
lobbyRoutes.post('/vote', lobbyController.vote)
lobbyRoutes.post('/order', lobbyController.order)
lobbyRoutes.post('/react', lobbyController.react)
lobbyRoutes.post('/side', lobbyController.side)
lobbyRoutes.post('/pick', lobbyController.pick)
lobbyRoutes.post('/end', lobbyController.end)
lobbyRoutes.post('/result', lobbyController.result)
// Print do placar: a imagem vai crua no corpo (PNG, JPG ou WebP, até 10 MB).
lobbyRoutes.post(
  '/stats/screenshot',
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '10mb' }),
  lobbyController.statsScreenshot,
)
lobbyRoutes.post('/stats', lobbyController.stats)
lobbyRoutes.post('/stats/skip', lobbyController.skipStats)
lobbyRoutes.post('/mvp', lobbyController.mvp)
lobbyRoutes.post('/bagre', lobbyController.bagre)
lobbyRoutes.post('/rematch', lobbyController.rematch)
lobbyRoutes.post('/leave', lobbyController.leave)

export default lobbyRoutes
