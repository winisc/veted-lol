import { Router } from 'express'
import { requireAuth } from '../../shared/middlewares/auth.middleware'
import { matchController } from './match.controller'

const matchRoutes = Router()

// Detalhe de uma partida salva: qualquer jogador logado pode ver.
matchRoutes.get('/:id', requireAuth, matchController.get)

export default matchRoutes
