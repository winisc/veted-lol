import { Router } from 'express'
import { requireAuth } from '../../shared/middlewares/auth.middleware'
import { adminController } from './admin.controller'
import { requireAdmin } from './admin.middleware'

const adminRoutes = Router()

adminRoutes.use(requireAuth, requireAdmin)

// Ao vivo: fila, confirmações e lobbies
adminRoutes.get('/live', adminController.live)
adminRoutes.post('/queue/remove', adminController.removeFromQueue)
adminRoutes.post('/queue/clear', adminController.clearQueue)
adminRoutes.post('/lobbies/:id/cancel', adminController.cancelLobby)
adminRoutes.post('/lobbies/:id/result', adminController.forceResult)

// Histórico de partidas
adminRoutes.get('/matches', adminController.matches)
adminRoutes.patch('/matches/:id', adminController.updateMatch)
adminRoutes.delete('/matches/:id', adminController.deleteMatch)

// Jogadores
adminRoutes.get('/users', adminController.users)
adminRoutes.post('/users/:id/admin', adminController.setAdmin)
adminRoutes.post('/users/:id/password', adminController.resetPassword)

export default adminRoutes
