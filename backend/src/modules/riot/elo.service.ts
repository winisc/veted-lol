import { userRepository } from '../users/user.repository'
import { riotService } from './riot.service'

// Elo do LoL de cada jogador, mostrado no draft. Fica em cache: a chave de desenvolvimento da Riot tem limite
// de consultas, então cada jogador é consultado no máximo a cada hora (e, se falhar, só tenta de novo em alguns minutos).
export interface PlayerElo {
  tier: string // IRON ... CHALLENGER
  rank: string // I, II, III, IV (Mestre para cima não tem divisão e vem "I")
  leaguePoints: number
  wins: number
  losses: number
  queue: 'solo' | 'flex'
}

const OK_TTL_MS = 60 * 60 * 1000
const FAIL_TTL_MS = 5 * 60 * 1000
const CONCURRENCY = 3

const cache = new Map<number, { elo: PlayerElo | null; expires: number }>()
const pending = new Map<number, Promise<boolean>>()

async function fetchOne(userId: number): Promise<boolean> {
  const user = userRepository.findById(userId)
  if (!user) return false
  // Bot do simulador: usa o elo simulado, sem consultar a Riot (e funciona mesmo sem chave da Riot).
  if (user.simElo !== null) {
    cache.set(userId, { elo: user.simElo === 'none' ? null : (JSON.parse(user.simElo) as PlayerElo), expires: Date.now() + OK_TTL_MS })
    return true
  }
  if (!riotService.isConfigured()) return false
  try {
    let puuid = user.puuid
    if (!puuid) {
      puuid = await riotService.puuidOf({ gameName: user.gameName, tagLine: user.tagLine })
      userRepository.setPuuid(userId, puuid)
    }
    const elo = await riotService.rankOf(puuid)
    cache.set(userId, { elo, expires: Date.now() + OK_TTL_MS })
    return true
  } catch {
    // Riot fora do ar, chave expirada, limite de consultas...: sem elo por enquanto; o draft segue normal.
    cache.set(userId, { elo: null, expires: Date.now() + FAIL_TTL_MS })
    return false
  }
}

export const eloService = {
  // Elo guardado (sem consultar a Riot). undefined = ainda não buscado; null = sem rank ou indisponível.
  cached(userId: number): PlayerElo | null | undefined {
    return cache.get(userId)?.elo
  },

  // Busca (em segundo plano) o elo de quem ainda não tem ou está vencido. Devolve se algum valor mudou/chegou.
  async refresh(userIds: number[]): Promise<boolean> {
    const stale = userIds.filter((id) => (cache.get(id)?.expires ?? 0) <= Date.now())
    if (stale.length === 0) return false

    const queue = [...stale]
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      let anyOk = false
      while (queue.length > 0) {
        const id = queue.shift()!
        // Quem já está sendo buscado (ex.: ao entrar na fila) não é buscado de novo.
        const running = pending.get(id)
        const task = running ?? fetchOne(id).finally(() => pending.delete(id))
        if (!running) pending.set(id, task)
        if (await task) anyOk = true
      }
      return anyOk
    })
    const results = await Promise.all(workers)
    return results.some(Boolean)
  },

  // Ao entrar na fila: já vai buscando, para o elo estar pronto quando o lobby abrir.
  warm(userId: number) {
    void eloService.refresh([userId])
  },
}
