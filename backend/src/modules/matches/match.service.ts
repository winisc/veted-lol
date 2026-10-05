import { AppError } from '../../shared/errors/AppError'
import { matchRepository } from './match.repository'

export const matchService = {
  get(matchId: string) {
    const match = matchRepository.findDetail(matchId)
    if (!match) throw new AppError('Partida não encontrada.', 404)
    return { match }
  },
}
