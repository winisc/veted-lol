import { Router } from 'express'
import { requireAuth } from '../../shared/middlewares/auth.middleware'
import { profileController } from './profile.controller'

const profileRoutes = Router()

profileRoutes.get('/', requireAuth, profileController.me)

export default profileRoutes
