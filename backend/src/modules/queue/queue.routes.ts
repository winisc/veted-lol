import { Router } from 'express'
import { requireAuth } from '../../shared/middlewares/auth.middleware'
import { queueController } from './queue.controller'

const queueRoutes = Router()

queueRoutes.use(requireAuth)

queueRoutes.get('/events', queueController.events)
queueRoutes.post('/join', queueController.join)
queueRoutes.post('/leave', queueController.leave)
queueRoutes.post('/standby', queueController.joinStandby)
queueRoutes.post('/standby/promote', queueController.promote)
queueRoutes.post('/accept', queueController.accept)
queueRoutes.post('/decline', queueController.decline)

export default queueRoutes
