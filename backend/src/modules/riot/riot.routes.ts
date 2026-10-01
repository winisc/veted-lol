import { Router } from 'express'
import { riotController } from './riot.controller'

const riotRoutes = Router()

riotRoutes.get('/lookup', riotController.lookup)

export default riotRoutes
