import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { AppError } from '../../shared/errors/AppError'
import { appEvents } from '../../shared/events/appEvents'
import { formatRiotId } from '../../shared/utils/riotId'
import { lobbyRepository } from '../lobby/lobby.repository'
import { lobbyService } from '../lobby/lobby.service'
import { userRepository } from '../users/user.repository'
import { queueEvents } from './queue.events'
import { queueRepository } from './queue.repository'
import type { QueueSnapshot, ReadyCheck } from './queue.types'

// QUEUE_SIZE permite testar com poucos jogadores. O padrão é 5x5 = 10.
const REQUIRED = Number(process.env.QUEUE_SIZE) || 10
// Prazo para aceitar a partida quando a fila fecha.
const READY_CHECK_MS = (Number(process.env.READY_CHECK_SECONDS) || 15) * 1000
// Tempo para o jogador reconectar (ex.: F5) antes de ser removido da fila.
const DISCONNECT_GRACE_MS = 15_000

const disconnectTimers = new Map<number, NodeJS.Timeout>()
const readyCheckTimers = new Map<string, NodeJS.Timeout>()

function snapshot(userId: number, notice?: string): QueueSnapshot {
  const base = { size: queueRepository.size(), required: REQUIRED, readyCheck: null, notice }

  if (lobbyRepository.findByUser(userId)) return { ...base, status: 'matched', players: [] }

  const check = queueRepository.findReadyCheck(userId)
  if (check) {
    return {
      ...base,
      status: 'ready_check',
      players: [],
      readyCheck: {
        endsAt: check.endsAt,
        durationMs: check.durationMs,
        now: Date.now(),
        accepted: check.accepted.size,
        total: check.players.length,
        iAccepted: check.accepted.has(userId),
      },
    }
  }

  const queued = queueRepository.isWaiting(userId)
  return {
    ...base,
    status: queued ? 'queued' : 'idle',
    players: queued
      ? queueRepository.list().map((p) => ({ riotId: p.riotId, iconId: p.iconId, isYou: p.userId === userId }))
      : [],
  }
}

function broadcast() {
  for (const userId of queueEvents.userIds()) queueEvents.send(userId, snapshot(userId))
}

// Fila com jogadores suficientes: os primeiros saem da fila e recebem a confirmação de partida.
function startReadyChecks() {
  while (queueRepository.size() >= REQUIRED) {
    const check: ReadyCheck = {
      id: randomUUID(),
      players: queueRepository.list().slice(0, REQUIRED),
      accepted: new Set(),
      endsAt: Date.now() + READY_CHECK_MS,
      durationMs: READY_CHECK_MS,
    }
    queueRepository.createReadyCheck(check)
    readyCheckTimers.set(
      check.id,
      setTimeout(() => {
        // Tempo esgotado: quem não aceitou sai da fila.
        failReadyCheck(check, check.players.filter((p) => !check.accepted.has(p.userId)).map((p) => p.userId))
      }, READY_CHECK_MS),
    )
  }
}

function clearReadyCheck(check: ReadyCheck) {
  const timer = readyCheckTimers.get(check.id)
  if (timer) clearTimeout(timer)
  readyCheckTimers.delete(check.id)
  queueRepository.deleteReadyCheck(check)
}

// Todos aceitaram: vira lobby.
function completeReadyCheck(check: ReadyCheck) {
  clearReadyCheck(check)
  lobbyService.create(check.players)
  broadcast()
}

// Alguém recusou ou não aceitou a tempo: essas pessoas saem da fila; quem aceitou volta para o começo dela.
function failReadyCheck(
  check: ReadyCheck,
  removedIds: number[],
  removedNotice = 'Você não aceitou a partida e saiu da fila.',
) {
  if (!queueRepository.findReadyCheck(check.players[0].userId)) return // já resolvida
  clearReadyCheck(check)

  const removed = new Set(removedIds)
  const returning = check.players.filter((p) => !removed.has(p.userId))
  queueRepository.addToFront(returning)
  startReadyChecks()

  for (const userId of queueEvents.userIds()) {
    let notice: string | undefined
    if (removed.has(userId)) notice = removedNotice
    else if (returning.some((p) => p.userId === userId)) {
      notice = 'Alguém não aceitou a partida. Você voltou para a fila sem perder a vez.'
    }
    queueEvents.send(userId, snapshot(userId, notice))
  }
}

// Quem deixa um lobby volta a ser "idle" na fila: avisa os clientes que ficam com a conexão aberta.
appEvents.on('lobby:left', (userIds: number[]) => {
  for (const userId of userIds) queueEvents.send(userId, snapshot(userId))
})

export const queueService = {
  snapshot,

  join(userId: number): QueueSnapshot {
    if (lobbyRepository.findByUser(userId)) throw new AppError('Você já está em um lobby.', 409)
    if (queueRepository.findReadyCheck(userId)) return snapshot(userId)

    if (!queueRepository.isWaiting(userId)) {
      const user = userRepository.findById(userId)
      if (!user) throw new AppError('Usuário não encontrado.', 401)

      queueRepository.add({ userId, riotId: formatRiotId(user.gameName, user.tagLine), iconId: user.iconId })
      startReadyChecks()
      broadcast()
    }

    return snapshot(userId)
  },

  // Sair da fila durante a confirmação conta como recusar.
  leave(userId: number): QueueSnapshot {
    const check = queueRepository.findReadyCheck(userId)
    if (check) {
      failReadyCheck(check, [userId])
      return snapshot(userId)
    }
    if (queueRepository.remove(userId)) broadcast()
    return snapshot(userId)
  },

  accept(userId: number): QueueSnapshot {
    const check = queueRepository.findReadyCheck(userId)
    if (!check) throw new AppError('Não há partida para aceitar.', 409)

    check.accepted.add(userId)
    if (check.accepted.size === check.players.length) completeReadyCheck(check)
    else for (const p of check.players) queueEvents.send(p.userId, snapshot(p.userId))
    return snapshot(userId)
  },

  decline(userId: number): QueueSnapshot {
    const check = queueRepository.findReadyCheck(userId)
    if (!check) throw new AppError('Não há partida para recusar.', 409)

    failReadyCheck(check, [userId])
    return snapshot(userId, 'Você recusou a partida e saiu da fila.')
  },

  // ---- Admin ----

  listForAdmin() {
    const waiting = queueRepository.list().map((p) => ({ id: p.userId, riotId: p.riotId, iconId: p.iconId }))
    const checks = queueRepository.allReadyChecks().map((c) => ({
      id: c.id,
      endsAt: c.endsAt,
      players: c.players.map((p) => ({ id: p.userId, riotId: p.riotId, iconId: p.iconId, accepted: c.accepted.has(p.userId) })),
    }))
    return { required: REQUIRED, waiting, readyChecks: checks }
  },

  // Tira um jogador da fila (ou da confirmação de partida, o que devolve os outros para a fila).
  adminRemove(userId: number) {
    const check = queueRepository.findReadyCheck(userId)
    if (check) {
      failReadyCheck(check, [userId], 'Um admin tirou você da fila.')
      return
    }
    if (!queueRepository.remove(userId)) throw new AppError('Esse jogador não está na fila.', 404)
    queueEvents.send(userId, snapshot(userId, 'Um admin tirou você da fila.'))
    broadcast()
  },

  // Esvazia a fila de espera (confirmações em andamento continuam).
  adminClear() {
    const removed = queueRepository.list().map((p) => p.userId)
    for (const userId of removed) queueRepository.remove(userId)
    for (const userId of removed) queueEvents.send(userId, snapshot(userId, 'Um admin esvaziou a fila.'))
    broadcast()
    return removed.length
  },

  subscribe(userId: number, req: Request, res: Response) {
    const timer = disconnectTimers.get(userId)
    if (timer) {
      clearTimeout(timer)
      disconnectTimers.delete(userId)
    }

    queueEvents.add(userId, res)
    queueEvents.send(userId, snapshot(userId))

    req.on('close', () => {
      queueEvents.remove(userId, res)
      if (queueEvents.hasConnection(userId) || !queueRepository.isWaiting(userId)) return

      // Fechou a aba: remove da fila depois de um tempo, para não sobrar jogador fantasma.
      // (Na confirmação de partida não precisa: quem não aceitar a tempo já sai.)
      disconnectTimers.set(
        userId,
        setTimeout(() => {
          disconnectTimers.delete(userId)
          if (!queueEvents.hasConnection(userId) && queueRepository.remove(userId)) broadcast()
        }, DISCONNECT_GRACE_MS),
      )
    })
  },
}
