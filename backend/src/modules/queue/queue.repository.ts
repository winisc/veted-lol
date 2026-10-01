import type { QueuePlayer, ReadyCheck } from './queue.types'

// Estado em memória: a fila é temporária e some se o servidor reiniciar.
// A Map mantém a ordem de inserção, então a fila é FIFO.
let waiting = new Map<number, QueuePlayer>()
const readyChecks = new Map<string, ReadyCheck>()
const readyCheckByUser = new Map<number, string>()

export const queueRepository = {
  isWaiting(userId: number) {
    return waiting.has(userId)
  },

  add(player: QueuePlayer) {
    waiting.set(player.userId, player)
  },

  // Devolve jogadores para o começo da fila (quem aceitou uma partida que não fechou não perde a vez).
  addToFront(players: QueuePlayer[]) {
    waiting = new Map([...players.map((p) => [p.userId, p] as const), ...waiting])
  },

  remove(userId: number) {
    return waiting.delete(userId)
  },

  list(): QueuePlayer[] {
    return [...waiting.values()]
  },

  size() {
    return waiting.size
  },

  // ---- confirmações de partida ----

  createReadyCheck(check: ReadyCheck) {
    readyChecks.set(check.id, check)
    for (const player of check.players) {
      waiting.delete(player.userId)
      readyCheckByUser.set(player.userId, check.id)
    }
  },

  allReadyChecks(): ReadyCheck[] {
    return [...readyChecks.values()]
  },

  findReadyCheck(userId: number): ReadyCheck | null {
    const id = readyCheckByUser.get(userId)
    return id ? (readyChecks.get(id) ?? null) : null
  },

  deleteReadyCheck(check: ReadyCheck) {
    readyChecks.delete(check.id)
    for (const player of check.players) {
      if (readyCheckByUser.get(player.userId) === check.id) readyCheckByUser.delete(player.userId)
    }
  },
}
