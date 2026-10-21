import express, { Router } from 'express'
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
// Print da pancada em partida já salva: ler o print (imagem crua no corpo) e gravar o que foi conferido
adminRoutes.post(
  '/matches/:id/stats/screenshot',
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '10mb' }),
  adminController.matchScreenshot,
)
adminRoutes.post('/matches/:id/stats', adminController.matchStats)

// Jogadores
adminRoutes.get('/users', adminController.users)
adminRoutes.post('/users/:id/admin', adminController.setAdmin)
adminRoutes.post('/users/:id/password', adminController.resetPassword)

// Banimentos (por Riot ID, com ou sem conta)
adminRoutes.get('/bans', adminController.bans)
adminRoutes.post('/bans', adminController.ban)
adminRoutes.post('/bans/remove', adminController.unban)

export default adminRoutes
