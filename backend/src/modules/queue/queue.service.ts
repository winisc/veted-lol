import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { AppError } from '../../shared/errors/AppError'
import { loadState, registerPersistence, schedulePersist } from '../../database/runtimeState'
import { appEvents } from '../../shared/events/appEvents'
import { QUEUE_MODES, isQueueMode, type QueueMode } from '../../shared/types/modes'
import { formatRiotId } from '../../shared/utils/riotId'
import { lobbyRepository } from '../lobby/lobby.repository'
import { lobbyService } from '../lobby/lobby.service'
import { eloService } from '../riot/elo.service'
import { userRepository } from '../users/user.repository'
import { queueEvents } from './queue.events'
import { queueRepository } from './queue.repository'
import type { DropReason, QueueSnapshot, ReadyCheck } from './queue.types'

// QUEUE_SIZE permite testar com poucos jogadores. O padrão é 5x5 = 10.
const REQUIRED = Number(process.env.QUEUE_SIZE) || 10
// Prazo para aceitar a partida quando a fila fecha.
const READY_CHECK_MS = (Number(process.env.READY_CHECK_SECONDS) || 15) * 1000
// Tamanho máximo da lista de espera de cada modo.
const STANDBY_MAX = Number(process.env.QUEUE_STANDBY_SIZE) || 5
// Tempo para o jogador reconectar (ex.: F5) antes de ser removido da fila.
const DISCONNECT_GRACE_MS = 15_000

const disconnectTimers = new Map<number, NodeJS.Timeout>()
const readyCheckTimers = new Map<string, NodeJS.Timeout>()

// A fila e as confirmações são guardadas no banco a cada mudança, para sobreviver a um reinício do servidor.
// Mude STATE_VERSION quando o formato mudar: estados guardados com outra versão são descartados.
const STATE_KEY = 'queue'
const STATE_VERSION = 1
// Depois de reiniciar, ninguém está conectado ainda: dá este tempo mínimo para aceitar a partida.
const RESTORE_GRACE_MS = 8_000
registerPersistence(STATE_KEY, () => ({ version: STATE_VERSION, ...queueRepository.dump() }))

// Prazo da confirmação: quem não aceitou sai da fila e os outros voltam para ela.
function armReadyCheckTimer(check: ReadyCheck, delayMs: number) {
  readyCheckTimers.set(
    check.id,
    setTimeout(() => {
      failReadyCheck(check, check.players.filter((p) => !check.accepted.has(p.userId)).map((p) => p.userId))
    }, delayMs),
  )
}

// Sem conexão aberta, o jogador na fila sai depois de um tempo (para não sobrar jogador fantasma).
function armDisconnectTimer(userId: number) {
  const existing = disconnectTimers.get(userId)
  if (existing) clearTimeout(existing)
  disconnectTimers.set(
    userId,
    setTimeout(() => {
      disconnectTimers.delete(userId)
      if (!queueEvents.hasConnection(userId) && (queueRepository.remove(userId) || queueRepository.removeStandby(userId))) {
        broadcast()
      }
    }, DISCONNECT_GRACE_MS),
  )
}

function snapshot(userId: number, notice?: string, dropped?: QueueSnapshot['dropped']): QueueSnapshot {
  const sizes = queueRepository.sizes()
  const base = {
    mode: null,
    size: 0,
    sizes,
    required: REQUIRED,
    readyCheck: null,
    notice,
    dropped,
    standbySizes: queueRepository.standbySizes(),
    standbyMax: STANDBY_MAX,
    standbyPlayers: [],
    standby: null,
  }
  const queuePlayers = (mode: QueueMode) =>
    queueRepository
      .list(mode)
      .map((p) => ({ userId: p.userId, riotId: p.riotId, iconId: p.iconId, isYou: p.userId === userId }))

  if (lobbyRepository.findByUser(userId)) return { ...base, status: 'matched', players: [] }

  const check = queueRepository.findReadyCheck(userId)
  if (check) {
    return {
      ...base,
      status: 'ready_check',
      mode: check.mode,
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

  // Na lista de espera: vê a fila do modo, mas não faz parte dela.
  const standbyMode = queueRepository.standbyModeOf(userId)
  if (standbyMode) {
    const list = queueRepository.listStandby(standbyMode)
    const position = list.findIndex((p) => p.userId === userId) + 1
    return {
      ...base,
      status: 'standby',
      mode: standbyMode,
      size: sizes[standbyMode],
      players: queuePlayers(standbyMode),
      standby: {
        position,
        size: list.length,
        canJoin: position === 1,
        players: list.map((p) => ({ userId: p.userId, riotId: p.riotId, iconId: p.iconId, isYou: p.userId === userId })),
      },
    }
  }

  const mode = queueRepository.modeOf(userId)
  return {
    ...base,
    status: mode ? 'queued' : 'idle',
    mode,
    standbyPlayers: mode
      ? queueRepository.listStandby(mode).map((p) => ({ userId: p.userId, riotId: p.riotId, iconId: p.iconId }))
      : [],
    size: mode ? sizes[mode] : 0,
    players: mode
      ? queueRepository
          .list(mode)
          .map((p) => ({ userId: p.userId, riotId: p.riotId, iconId: p.iconId, isYou: p.userId === userId }))
      : [],
  }
}

function broadcast() {
  schedulePersist(STATE_KEY)
  for (const userId of queueEvents.userIds()) queueEvents.send(userId, snapshot(userId))
}

// Fila com jogadores suficientes: os primeiros saem da fila e recebem a confirmação de partida.
function startReadyChecks(mode: QueueMode) {
  while (queueRepository.size(mode) >= REQUIRED) {
    const check: ReadyCheck = {
      id: randomUUID(),
      mode,
      players: queueRepository.list(mode).slice(0, REQUIRED),
      accepted: new Set(),
      endsAt: Date.now() + READY_CHECK_MS,
      durationMs: READY_CHECK_MS,
    }
    queueRepository.createReadyCheck(check)
    armReadyCheckTimer(check, READY_CHECK_MS) // tempo esgotado: quem não aceitou sai da fila
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
  lobbyService.create(check.players, check.mode)
  broadcast()
}

// Alguém recusou ou não aceitou a tempo: essas pessoas saem da fila; quem aceitou volta para o começo dela.
function failReadyCheck(
  check: ReadyCheck,
  removedIds: number[],
  removedNotice = 'Você não aceitou a partida e saiu da fila.',
  reason: DropReason = 'timeout',
) {
  if (!queueRepository.findReadyCheck(check.players[0].userId)) return // já resolvida
  clearReadyCheck(check)
  schedulePersist(STATE_KEY)

  const removed = new Set(removedIds)
  const returning = check.players.filter((p) => !removed.has(p.userId))
  // Quem ficou de fora, para mostrar a quem voltou para a fila.
  const dropped = check.players
    .filter((p) => removed.has(p.userId))
    .map((p) => ({ riotId: p.riotId, iconId: p.iconId, reason }))
  queueRepository.addToFront(check.mode, returning)
  startReadyChecks(check.mode)

  for (const userId of queueEvents.userIds()) {
    let notice: string | undefined
    let list: QueueSnapshot['dropped']
    if (removed.has(userId)) notice = removedNotice
    else if (returning.some((p) => p.userId === userId)) {
      notice = 'Alguém não aceitou a partida. Você voltou para a fila sem perder a vez.'
      list = dropped
    }
    queueEvents.send(userId, snapshot(userId, notice, list))
  }
}

// Quem deixa um lobby volta a ser "idle" na fila: avisa os clientes que ficam com a conexão aberta.
appEvents.on('lobby:left', (userIds: number[]) => {
  for (const userId of userIds) queueEvents.send(userId, snapshot(userId))
})

export const queueService = {
  snapshot,

  // Recupera a fila e as confirmações guardadas e religa os relógios. Devolve quantos jogadores voltaram.
  restore(): number {
    const saved = loadState<{
      version: number
      waiting: Record<QueueMode, import('./queue.types').QueuePlayer[]>
      readyChecks: ReadyCheck[]
    }>(STATE_KEY)
    if (!saved || saved.version !== STATE_VERSION) return 0

    queueRepository.restore(saved)
    for (const check of saved.readyChecks) {
      const remaining = Math.max(check.endsAt - Date.now(), RESTORE_GRACE_MS)
      check.endsAt = Date.now() + remaining
      armReadyCheckTimer(check, remaining)
    }
    // Quem estava esperando precisa reconectar; quem não voltar sai da fila pelo tempo de tolerância de sempre.
    const waiting = QUEUE_MODES.flatMap((mode) => [...queueRepository.list(mode), ...queueRepository.listStandby(mode)])
    for (const player of waiting) armDisconnectTimer(player.userId)

    return waiting.length + saved.readyChecks.reduce((sum, check) => sum + check.players.length, 0)
  },

  // Entra na fila do modo escolhido. Quem já está na outra fila troca de fila.
  join(userId: number, mode: unknown = 'vote'): QueueSnapshot {
    if (!isQueueMode(mode)) throw new AppError('Modo de fila inválido.', 400)
    if (lobbyRepository.findByUser(userId)) throw new AppError('Você já está em um lobby.', 409)
    if (queueRepository.findReadyCheck(userId)) {
      throw new AppError('Você está numa confirmação de partida. Aceite ou recuse antes de trocar de fila.', 409)
    }
    // Quem está na espera só entra na fila pelo botão da espera (e só o primeiro).
    if (queueRepository.standbyModeOf(userId)) {
      throw new AppError('Você está na lista de espera. Quando for o primeiro, use "Entrar na fila" da espera.', 409)
    }

    const current = queueRepository.modeOf(userId)
    if (current !== mode) {
      const user = userRepository.findById(userId)
      if (!user) throw new AppError('Usuário não encontrado.', 401)
      // Para entrar na fila, o jogador precisa ter as 3 roles salvas no perfil.
      const { main, secondary, worst } = user.roles
      if (!main || !secondary || !worst) {
        throw new AppError('Defina suas roles no perfil antes de entrar na fila.', 409, 'ROLES_REQUIRED')
      }

      if (current) queueRepository.remove(userId)
      queueRepository.add(mode, { userId, riotId: formatRiotId(user.gameName, user.tagLine), iconId: user.iconId })
      eloService.warm(userId) // em segundo plano: o elo já estará pronto quando o draft abrir
      startReadyChecks(mode)
      broadcast()
    }

    return snapshot(userId)
  },

  // Sair da fila durante a confirmação conta como recusar.
  leave(userId: number): QueueSnapshot {
    const check = queueRepository.findReadyCheck(userId)
    if (check) {
      failReadyCheck(check, [userId], undefined, 'declined')
      return snapshot(userId)
    }
    // Sai da fila e também da lista de espera (o mesmo botão "Sair" serve para os dois).
    const left = queueRepository.remove(userId)
    const leftStandby = queueRepository.removeStandby(userId)
    if (left || leftStandby) broadcast()
    return snapshot(userId)
  },

  // Entra na lista de espera de um modo: fica fora da fila, vendo a fila atual, na ordem de chegada.
  // Quem está na fila também pode ir para a espera: sai da fila e entra no fim da lista (se houver vaga nela).
  joinStandby(userId: number, mode: unknown): QueueSnapshot {
    if (!isQueueMode(mode)) throw new AppError('Modo de fila inválido.', 400)
    if (lobbyRepository.findByUser(userId)) throw new AppError('Você já está em um lobby.', 409)
    if (queueRepository.findReadyCheck(userId)) throw new AppError('Você está numa confirmação de partida.', 409)

    const current = queueRepository.standbyModeOf(userId)
    if (current === mode) return snapshot(userId) // já está nessa espera

    const user = userRepository.findById(userId)
    if (!user) throw new AppError('Usuário não encontrado.', 401)
    // Mesma exigência da fila: as 3 roles salvas no perfil.
    const { main, secondary, worst } = user.roles
    if (!main || !secondary || !worst) {
      throw new AppError('Defina suas roles no perfil antes de entrar na fila.', 409, 'ROLES_REQUIRED')
    }
    if (queueRepository.listStandby(mode).length >= STANDBY_MAX) {
      throw new AppError(`A lista de espera deste modo está cheia (${STANDBY_MAX}/${STANDBY_MAX}).`, 409)
    }

    if (current) queueRepository.removeStandby(userId) // troca de espera: vai para o fim da outra
    queueRepository.remove(userId) // veio da fila: sai dela (só depois de saber que há vaga na espera)
    queueRepository.addStandby(mode, { userId, riotId: formatRiotId(user.gameName, user.tagLine), iconId: user.iconId })
    broadcast()
    return snapshot(userId)
  },

  // O primeiro da espera entra na fila de verdade (a qualquer momento). Quem vem depois passa a ser o primeiro.
  promoteFromStandby(userId: number): QueueSnapshot {
    const mode = queueRepository.standbyModeOf(userId)
    if (!mode) throw new AppError('Você não está na lista de espera.', 409)
    if (queueRepository.listStandby(mode)[0]?.userId !== userId) {
      throw new AppError('Só o primeiro da espera pode entrar na fila.', 409)
    }

    queueRepository.removeStandby(userId)
    return queueService.join(userId, mode)
  },

  accept(userId: number): QueueSnapshot {
    const check = queueRepository.findReadyCheck(userId)
    if (!check) throw new AppError('Não há partida para aceitar.', 409)

    check.accepted.add(userId)
    schedulePersist(STATE_KEY)
    if (check.accepted.size === check.players.length) completeReadyCheck(check)
    else for (const p of check.players) queueEvents.send(p.userId, snapshot(p.userId))
    return snapshot(userId)
  },

  decline(userId: number): QueueSnapshot {
    const check = queueRepository.findReadyCheck(userId)
    if (!check) throw new AppError('Não há partida para recusar.', 409)

    failReadyCheck(check, [userId], undefined, 'declined')
    return snapshot(userId, 'Você recusou a partida e saiu da fila.')
  },

  // ---- Admin ----

  listForAdmin() {
    const waiting = QUEUE_MODES.flatMap((mode) =>
      queueRepository.list(mode).map((p) => ({ id: p.userId, riotId: p.riotId, iconId: p.iconId, mode })),
    )
    const checks = queueRepository.allReadyChecks().map((c) => ({
      id: c.id,
      mode: c.mode,
      endsAt: c.endsAt,
      players: c.players.map((p) => ({ id: p.userId, riotId: p.riotId, iconId: p.iconId, accepted: c.accepted.has(p.userId) })),
    }))
    const standbyList = QUEUE_MODES.flatMap((mode) =>
      queueRepository.listStandby(mode).map((p) => ({ id: p.userId, riotId: p.riotId, iconId: p.iconId, mode })),
    )
    return { required: REQUIRED, waiting, standby: standbyList, readyChecks: checks }
  },

  // Tira um jogador da fila (ou da confirmação de partida, o que devolve os outros para a fila).
  adminRemove(userId: number) {
    const check = queueRepository.findReadyCheck(userId)
    if (check) {
      failReadyCheck(check, [userId], 'Um admin tirou você da fila.', 'removed')
      return
    }
    if (!queueRepository.remove(userId) && !queueRepository.removeStandby(userId)) {
      throw new AppError('Esse jogador não está na fila.', 404)
    }
    queueEvents.send(userId, snapshot(userId, 'Um admin tirou você da fila.'))
    broadcast()
  },

  // Esvazia a fila de espera (confirmações em andamento continuam).
  adminClear() {
    const removed = QUEUE_MODES.flatMap((mode) => [
      ...queueRepository.list(mode).map((p) => p.userId),
      ...queueRepository.listStandby(mode).map((p) => p.userId),
    ])
    for (const userId of removed) {
      queueRepository.remove(userId)
      queueRepository.removeStandby(userId)
    }
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
      if (queueEvents.hasConnection(userId)) return
      if (!queueRepository.isWaiting(userId) && !queueRepository.standbyModeOf(userId)) return

      // Fechou a aba: remove da fila depois de um tempo, para não sobrar jogador fantasma.
      // (Na confirmação de partida não precisa: quem não aceitar a tempo já sai.)
      armDisconnectTimer(userId)
    })
  },
}
