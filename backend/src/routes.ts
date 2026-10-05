import { Router } from 'express'
import adminRoutes from './modules/admin/admin.routes'
import authRoutes from './modules/auth/auth.routes'
import lobbyRoutes from './modules/lobby/lobby.routes'
import matchRoutes from './modules/matches/match.routes'
import profileRoutes from './modules/profile/profile.routes'
import queueRoutes from './modules/queue/queue.routes'
import rankingRoutes from './modules/ranking/ranking.routes'
import riotRoutes from './modules/riot/riot.routes'

const routes = Router()

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'API funcionando' })
})

routes.use('/auth', authRoutes)
routes.use('/riot', riotRoutes)
routes.use('/queue', queueRoutes)
routes.use('/lobby', lobbyRoutes)
routes.use('/profile', profileRoutes)
routes.use('/matches', matchRoutes)
routes.use('/ranking', rankingRoutes)
routes.use('/admin', adminRoutes)

export default routes
