import { Router } from 'express'
import { requireAuth } from '../../shared/middlewares/auth.middleware'
import { rankingController } from './ranking.controller'

const rankingRoutes = Router()

rankingRoutes.get('/', requireAuth, rankingController.list)

export default rankingRoutes
