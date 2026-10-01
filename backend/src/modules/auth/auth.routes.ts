import { Router } from 'express'
import { requireAuth } from '../../shared/middlewares/auth.middleware'
import { authController } from './auth.controller'

const authRoutes = Router()

authRoutes.post('/register', authController.register)
authRoutes.post('/login', authController.login)
authRoutes.get('/me', requireAuth, authController.me)

export default authRoutes
