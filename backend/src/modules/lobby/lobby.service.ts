import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { AppError } from '../../shared/errors/AppError'
import { appEvents } from '../../shared/events/appEvents'
import { lobbyConfig } from './lobby.config'
import { lobbyEvents } from './lobby.events'
import { lobbyRepository } from './lobby.repository'
import {
  countMvpVotes,
  countResultVotes,
  countVotes,
  currentPickerId,
  draftPool,
  mvpCandidates,
  snapshotFor,
  votesNeeded,
} from './lobby.snapshot'
import type { Lobby, LobbyEvent, LobbyPhase, LobbyPlayer, LobbySnapshot, MatchOutcome, Side } from './lobby.types'
import { matchRepository } from '../matches/match.repository'

const timers = new Map<string, NodeJS.Timeout>()

const randomItem = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)]
const otherSide = (side: Side): Side => (side === 'blue' ? 'red' : 'blue')

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function sendTo(userId: number, event: LobbyEvent) {
  lobbyEvents.send(userId, event)
}

function broadcast(lobby: Lobby) {
  for (const player of lobby.players) {
    if (lobby.left.has(player.userId)) continue // já saiu do lobby
    sendTo(player.userId, { lobby: snapshotFor(lobby, player.userId) })
  }
}

function clearTimer(lobbyId: string) {
  const timer = timers.get(lobbyId)
  if (timer) clearTimeout(timer)
  timers.delete(lobbyId)
}

// Entra em uma fase. Se ela tiver duração, `onTimeout` roda quando o tempo acabar.
function setPhase(lobby: Lobby, phase: LobbyPhase, durationMs: number | null, onTimeout?: () => void) {
  clearTimer(lobby.id)
  lobby.phase = phase
  lobby.endsAt = durationMs === null ? null : Date.now() + durationMs
  lobby.durationMs = durationMs ?? 0
  if (durationMs !== null && onTimeout) timers.set(lobby.id, setTimeout(onTimeout, durationMs))
  broadcast(lobby)
}

// ---- Fluxo: votação -> resultado -> sorteio -> lado -> picks -> fim ----

// Os mais votados viram capitães. Empates (e quem não recebeu voto) são sorteados.
function pickCaptains(lobby: Lobby): number[] {
  const counts = countVotes(lobby)
  return shuffle(lobby.players)
    .sort((a, b) => (counts.get(b.userId) ?? 0) - (counts.get(a.userId) ?? 0))
    .slice(0, lobbyConfig.captains)
    .map((p) => p.userId)
}

function finishVoting(lobby: Lobby) {
  lobby.captains = pickCaptains(lobby)
  setPhase(lobby, 'captains', lobbyConfig.revealMs, () => startCoinflip(lobby))
}

// Sorteio entre os capitães: quem ganha escolhe primeiro, quem perde escolhe o lado.
function startCoinflip(lobby: Lobby) {
  const winner = randomItem(lobby.captains)
  lobby.firstPickId = winner
  lobby.sideChooserId = lobby.captains.find((id) => id !== winner) ?? null
  setPhase(lobby, 'coinflip', lobbyConfig.coinflipMs, () => startSide(lobby))
}

function startSide(lobby: Lobby) {
  setPhase(lobby, 'side', lobbyConfig.sideMs, () => applySide(lobby, randomItem<Side>(['blue', 'red'])))
}

// Um pick por jogador que não é capitão (8 em um lobby de 10).
function buildPickOrder(firstId: number, secondId: number, pickCount: number): number[] {
  return lobbyConfig.pickPattern
    .flatMap((count, i) => Array(count).fill(i % 2 === 0 ? firstId : secondId) as number[])
    .slice(0, pickCount)
}

function applySide(lobby: Lobby, side: Side) {
  const chooserId = lobby.sideChooserId!
  const firstId = lobby.firstPickId!

  lobby.sides = { [side]: chooserId, [otherSide(side)]: firstId }
  lobby.teams = { blue: [lobby.sides.blue!], red: [lobby.sides.red!] }
  lobby.pickOrder = buildPickOrder(firstId, chooserId, lobby.players.length - lobby.captains.length)
  lobby.pickIndex = 0
  setPhase(lobby, 'picking', lobbyConfig.pickMs, () => autoPick(lobby))
}

function applyPick(lobby: Lobby, playerId: number) {
  const byId = lobby.pickOrder[lobby.pickIndex]
  const side: Side = lobby.sides.blue === byId ? 'blue' : 'red'

  lobby.teams[side].push(playerId)
  lobby.picks.push({ playerId, byId, order: lobby.pickIndex + 1 })
  lobby.pickIndex++

  if (lobby.pickIndex >= lobby.pickOrder.length) setPhase(lobby, 'done', lobbyConfig.doneMs, () => startPlaying(lobby))
  else setPhase(lobby, 'picking', lobbyConfig.pickMs, () => autoPick(lobby))
}

// Capitão ausente: o tempo acabou, escolhe um jogador aleatório para o draft não travar.
function autoPick(lobby: Lobby) {
  applyPick(lobby, randomItem(draftPool(lobby)).userId)
}

// ---- Partida: em andamento -> votação do vencedor -> MVP -> salva no histórico ----

function startPlaying(lobby: Lobby) {
  lobby.startedAt = Date.now()
  setPhase(lobby, 'playing', null)
}

function settleResult(lobby: Lobby, outcome: MatchOutcome) {
  lobby.outcome = outcome
  // Remake não tem vencedor nem MVP.
  if (outcome === 'remake') finishMatch(lobby)
  else setPhase(lobby, 'mvp', lobbyConfig.mvpMs, () => finishMvp(lobby))
}

// O mais votado é o MVP; empate é sorteado; sem nenhum voto, ninguém é MVP.
function pickMvp(lobby: Lobby): number | null {
  const counts = countMvpVotes(lobby)
  if (counts.size === 0) return null
  const top = Math.max(...counts.values())
  return randomItem([...counts].filter(([, n]) => n === top).map(([id]) => id))
}

function finishMvp(lobby: Lobby) {
  lobby.mvpId = pickMvp(lobby)
  finishMatch(lobby)
}

// Revanche: mesmos times e capitães, mas os lados se invertem e a partida começa direto (sem novo draft).
function startRematch(lobby: Lobby) {
  lobby.teams = { blue: lobby.teams.red, red: lobby.teams.blue }
  lobby.sides = { blue: lobby.sides.red, red: lobby.sides.blue }

  lobby.matchId = randomUUID()
  lobby.gameNumber++
  lobby.endedAt = null
  lobby.endVotes = new Set()
  lobby.resultVotes = new Map()
  lobby.outcome = null
  lobby.mvpVotes = new Map()
  lobby.mvpId = null
  lobby.rematchVotes = new Set()

  startPlaying(lobby)
}

function finishMatch(lobby: Lobby) {
  try {
    matchRepository.save({
      id: lobby.matchId,
      startedAt: lobby.startedAt ?? lobby.createdAt,
      endedAt: lobby.endedAt ?? Date.now(),
      outcome: lobby.outcome!,
      mvpId: lobby.mvpId,
      players: lobby.players.map((p) => ({
        userId: p.userId,
        side: lobby.teams.blue.includes(p.userId) ? 'blue' : 'red',
        isCaptain: lobby.captains.includes(p.userId),
      })),
    })
  } catch (err) {
    // Não trava os jogadores se o banco falhar; o resultado ainda aparece na tela.
    console.error('Falha ao salvar a partida no histórico:', err)
  }
  setPhase(lobby, 'finished', null)
}

// Fecha o lobby para todos, avisando o motivo (quem causou o cancelamento não recebe aviso).
function cancelLobby(lobby: Lobby, notice: string, causedBy?: number) {
  clearTimer(lobby.id)
  for (const player of lobby.players) {
    if (lobby.left.has(player.userId)) continue
    sendTo(player.userId, { lobby: null, notice: player.userId === causedBy ? undefined : notice })
  }
  lobbyRepository.delete(lobby)
  appEvents.emit('lobby:left', lobby.players.map((p) => p.userId))
}

function requireLobby(userId: number): Lobby {
  const lobby = lobbyRepository.findByUser(userId)
  if (!lobby) throw new AppError('Você não está em um lobby.', 404)
  return lobby
}

export const lobbyService = {
  create(players: LobbyPlayer[]): Lobby {
    const lobby: Lobby = {
      id: randomUUID(),
      players,
      phase: 'voting',
      votes: new Map(),
      endsAt: null,
      durationMs: 0,
      captains: [],
      firstPickId: null,
      sideChooserId: null,
      sides: {},
      teams: { blue: [], red: [] },
      pickOrder: [],
      pickIndex: 0,
      picks: [],
      startedAt: null,
      endedAt: null,
      endVotes: new Set(),
      resultVotes: new Map(),
      outcome: null,
      mvpVotes: new Map(),
      mvpId: null,
      matchId: randomUUID(),
      gameNumber: 1,
      rematchVotes: new Set(),
      left: new Set(),
      createdAt: Date.now(),
    }
    lobbyRepository.create(lobby)
    setPhase(lobby, 'voting', lobbyConfig.voteMs, () => finishVoting(lobby))
    return lobby
  },

  current(userId: number): LobbySnapshot | null {
    const lobby = lobbyRepository.findByUser(userId)
    return lobby ? snapshotFor(lobby, userId) : null
  },

  // Voto de capitão: um só, sem troca.
  vote(userId: number, targetId: unknown): LobbySnapshot {
    const lobby = requireLobby(userId)
    if (lobby.phase !== 'voting') throw new AppError('A votação já terminou.', 409)
    if (lobby.votes.has(userId)) throw new AppError('Você já votou. O voto não pode ser alterado.', 409)
    if (typeof targetId !== 'number' || !lobby.players.some((p) => p.userId === targetId)) {
      throw new AppError('Jogador inválido.', 400)
    }

    lobby.votes.set(userId, targetId)
    if (lobby.votes.size === lobby.players.length) finishVoting(lobby)
    else broadcast(lobby)

    return snapshotFor(lobby, userId)
  },

  // O capitão que perdeu o sorteio escolhe o lado.
  chooseSide(userId: number, side: unknown): LobbySnapshot {
    const lobby = requireLobby(userId)
    if (lobby.phase !== 'side') throw new AppError('Não é o momento de escolher o lado.', 409)
    if (userId !== lobby.sideChooserId) throw new AppError('Só o capitão que perdeu o sorteio escolhe o lado.', 403)
    if (side !== 'blue' && side !== 'red') throw new AppError('Lado inválido.', 400)

    applySide(lobby, side)
    return snapshotFor(lobby, userId)
  },

  // Pick de um jogador pelo capitão da vez.
  pick(userId: number, playerId: unknown): LobbySnapshot {
    const lobby = requireLobby(userId)
    if (lobby.phase !== 'picking') throw new AppError('Não é o momento de escolher jogadores.', 409)
    if (userId !== currentPickerId(lobby)) throw new AppError('Não é a sua vez de escolher.', 403)
    if (typeof playerId !== 'number' || !draftPool(lobby).some((p) => p.userId === playerId)) {
      throw new AppError('Jogador indisponível.', 400)
    }

    applyPick(lobby, playerId)
    return snapshotFor(lobby, userId)
  },

  // Voto de cada jogador para declarar o fim da partida (pode ser desfeito). Com votos suficientes, vai para o resultado.
  voteEnd(userId: number, vote: unknown): LobbySnapshot {
    const lobby = requireLobby(userId)
    if (lobby.phase !== 'playing') throw new AppError('A partida não está em andamento.', 409)
    if (typeof vote !== 'boolean') throw new AppError('Voto inválido.', 400)

    if (vote) lobby.endVotes.add(userId)
    else lobby.endVotes.delete(userId)

    if (lobby.endVotes.size >= votesNeeded(lobby)) {
      lobby.endedAt = Date.now()
      setPhase(lobby, 'result', null)
    } else {
      broadcast(lobby)
    }
    return snapshotFor(lobby, userId)
  },

  // Voto de vencedor (time azul, vermelho ou remake). A primeira opção com votos suficientes vence.
  voteResult(userId: number, choice: unknown): LobbySnapshot {
    const lobby = requireLobby(userId)
    if (lobby.phase !== 'result') throw new AppError('Não é o momento de votar no resultado.', 409)
    if (choice !== 'blue' && choice !== 'red' && choice !== 'remake') throw new AppError('Opção inválida.', 400)

    lobby.resultVotes.set(userId, choice)
    if (countResultVotes(lobby)[choice] >= votesNeeded(lobby)) settleResult(lobby, choice)
    else broadcast(lobby)
    return snapshotFor(lobby, userId)
  },

  // Voto de MVP entre os jogadores do time vencedor. Todos votam, mas ninguém vota em si mesmo.
  voteMvp(userId: number, targetId: unknown): LobbySnapshot {
    const lobby = requireLobby(userId)
    if (lobby.phase !== 'mvp') throw new AppError('Não é o momento de votar no MVP.', 409)
    // Voto de MVP: um só, sem troca (igual ao de capitão).
    if (lobby.mvpVotes.has(userId)) throw new AppError('Você já votou. O voto não pode ser alterado.', 409)
    if (typeof targetId !== 'number' || !mvpCandidates(lobby).includes(targetId)) {
      throw new AppError('Esse jogador não é do time vencedor.', 400)
    }
    if (targetId === userId) throw new AppError('Você não pode votar em si mesmo.', 400)

    lobby.mvpVotes.set(userId, targetId)
    if (lobby.mvpVotes.size === lobby.players.length) finishMvp(lobby)
    else broadcast(lobby)
    return snapshotFor(lobby, userId)
  },

  // Voto para jogar novamente (pode ser desfeito). Com votos suficientes, começa a revanche com os lados trocados.
  voteRematch(userId: number, vote: unknown): LobbySnapshot {
    const lobby = requireLobby(userId)
    if (lobby.phase === 'rematch') throw new AppError('A revanche já foi decidida.', 409)
    if (lobby.phase !== 'finished') throw new AppError('A partida ainda não terminou.', 409)
    if (lobby.left.size > 0) throw new AppError('Alguém já saiu do lobby, então não dá para jogar novamente.', 409)
    if (typeof vote !== 'boolean') throw new AppError('Voto inválido.', 400)

    if (vote) lobby.rematchVotes.add(userId)
    else lobby.rematchVotes.delete(userId)

    // Com votos suficientes, abre a contagem; os lados só trocam quando ela acaba.
    if (lobby.rematchVotes.size >= votesNeeded(lobby)) setPhase(lobby, 'rematch', lobbyConfig.rematchMs, () => startRematch(lobby))
    else broadcast(lobby)
    return snapshotFor(lobby, userId)
  },

  // Antes da partida começar, sair cancela o lobby para todos (precisa dos 10 jogadores).
  // Durante a partida não dá para sair. Depois de finalizada, cada jogador sai por si,
  // e a revanche deixa de estar disponível para os que ficaram.
  leave(userId: number) {
    const lobby = lobbyRepository.findByUser(userId)
    if (!lobby) return

    if (lobby.phase === 'finished' || lobby.phase === 'rematch') {
      lobby.left.add(userId)
      lobby.rematchVotes.delete(userId)
      lobbyRepository.removeUser(lobby, userId)
      sendTo(userId, { lobby: null })
      appEvents.emit('lobby:left', [userId])

      // Saiu durante a contagem da revanche: sem os 10 jogadores ela é desfeita.
      if (lobby.phase === 'rematch') {
        lobby.rematchVotes.clear()
        setPhase(lobby, 'finished', null)
      } else {
        broadcast(lobby)
      }
      return
    }
    if (lobby.phase === 'playing' || lobby.phase === 'result' || lobby.phase === 'mvp') {
      throw new AppError('A partida está em andamento. Termine-a para sair.', 409)
    }

    const leaver = lobby.players.find((p) => p.userId === userId)
    cancelLobby(lobby, `${leaver?.riotId} saiu e o lobby foi cancelado.`, userId)
  },

  // ---- Admin ----

  listForAdmin() {
    return lobbyRepository.all().map((lobby) => ({
      id: lobby.id,
      phase: lobby.phase,
      gameNumber: lobby.gameNumber,
      createdAt: lobby.createdAt,
      startedAt: lobby.startedAt,
      players: lobby.players
        .filter((p) => !lobby.left.has(p.userId))
        .map((p) => ({
          id: p.userId,
          riotId: p.riotId,
          iconId: p.iconId,
          team: lobby.teams.blue.includes(p.userId) ? 'blue' : lobby.teams.red.includes(p.userId) ? 'red' : null,
          isCaptain: lobby.captains.includes(p.userId),
        })),
    }))
  },

  // Cancela o lobby para todos (ex.: alguém sumiu e a partida travou). Nada é salvo no histórico.
  adminCancel(lobbyId: string) {
    const lobby = lobbyRepository.findById(lobbyId)
    if (!lobby) throw new AppError('Lobby não encontrado.', 404)
    cancelLobby(lobby, 'Um admin cancelou o lobby.')
  },

  // Encerra a partida em andamento com o resultado escolhido (sem MVP) e salva no histórico.
  adminForceResult(lobbyId: string, outcome: unknown) {
    const lobby = lobbyRepository.findById(lobbyId)
    if (!lobby) throw new AppError('Lobby não encontrado.', 404)
    if (outcome !== 'blue' && outcome !== 'red' && outcome !== 'remake') throw new AppError('Resultado inválido.', 400)
    if (lobby.phase !== 'playing' && lobby.phase !== 'result' && lobby.phase !== 'mvp') {
      throw new AppError('Só dá para forçar o resultado de uma partida em andamento.', 409)
    }

    lobby.endedAt = lobby.endedAt ?? Date.now()
    lobby.outcome = outcome
    lobby.mvpId = null
    finishMatch(lobby)
  },

  subscribe(userId: number, req: Request, res: Response) {
    lobbyEvents.add(userId, res)
    sendTo(userId, { lobby: lobbyService.current(userId) })
    req.on('close', () => lobbyEvents.remove(userId, res))
  },
}
