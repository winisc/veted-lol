import { Router } from 'express'
import { requireAuth } from '../../shared/middlewares/auth.middleware'
import { lobbyController } from './lobby.controller'

const lobbyRoutes = Router()

lobbyRoutes.use(requireAuth)

lobbyRoutes.get('/', lobbyController.current)
lobbyRoutes.get('/events', lobbyController.events)
lobbyRoutes.post('/vote', lobbyController.vote)
lobbyRoutes.post('/side', lobbyController.side)
lobbyRoutes.post('/pick', lobbyController.pick)
lobbyRoutes.post('/end', lobbyController.end)
lobbyRoutes.post('/result', lobbyController.result)
lobbyRoutes.post('/mvp', lobbyController.mvp)
lobbyRoutes.post('/rematch', lobbyController.rematch)
lobbyRoutes.post('/leave', lobbyController.leave)

export default lobbyRoutes
