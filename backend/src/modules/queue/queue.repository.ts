import { QUEUE_MODES, type QueueMode } from '../../shared/types/modes'
import type { QueuePlayer, ReadyCheck } from './queue.types'

// Estado em memória: as filas são temporárias e somem se o servidor reiniciar.
// Uma fila por modo; a Map mantém a ordem de inserção, então cada fila é FIFO.
const waiting: Record<QueueMode, Map<number, QueuePlayer>> = { vote: new Map(), ranked: new Map() }
const readyChecks = new Map<string, ReadyCheck>()
const readyCheckByUser = new Map<number, string>()

export const queueRepository = {
  // Estado inteiro para guardar no banco (ver database/runtimeState.ts).
  dump() {
    return {
      waiting: { vote: [...waiting.vote.values()], ranked: [...waiting.ranked.values()] },
      readyChecks: [...readyChecks.values()],
    }
  },

  // Recoloca o estado guardado (ao iniciar o servidor).
  restore(saved: { waiting: Record<QueueMode, QueuePlayer[]>; readyChecks: ReadyCheck[] }) {
    for (const mode of QUEUE_MODES) waiting[mode] = new Map((saved.waiting[mode] ?? []).map((p) => [p.userId, p] as const))
    for (const check of saved.readyChecks) {
      readyChecks.set(check.id, check)
      for (const player of check.players) readyCheckByUser.set(player.userId, check.id)
    }
  },

  // Em qual fila o jogador está esperando (null se em nenhuma).
  modeOf(userId: number): QueueMode | null {
    return QUEUE_MODES.find((mode) => waiting[mode].has(userId)) ?? null
  },

  isWaiting(userId: number) {
    return this.modeOf(userId) !== null
  },

  add(mode: QueueMode, player: QueuePlayer) {
    waiting[mode].set(player.userId, player)
  },

  // Devolve jogadores para o começo da fila (quem aceitou uma partida que não fechou não perde a vez).
  addToFront(mode: QueueMode, players: QueuePlayer[]) {
    waiting[mode] = new Map([...players.map((p) => [p.userId, p] as const), ...waiting[mode]])
  },

  // Remove de qualquer fila.
  remove(userId: number) {
    return QUEUE_MODES.some((mode) => waiting[mode].delete(userId))
  },

  list(mode: QueueMode): QueuePlayer[] {
    return [...waiting[mode].values()]
  },

  size(mode: QueueMode) {
    return waiting[mode].size
  },

  sizes(): Record<QueueMode, number> {
    return { vote: waiting.vote.size, ranked: waiting.ranked.size }
  },

  // ---- confirmações de partida ----

  createReadyCheck(check: ReadyCheck) {
    readyChecks.set(check.id, check)
    for (const player of check.players) {
      waiting[check.mode].delete(player.userId)
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
