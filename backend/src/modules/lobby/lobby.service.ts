import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { AppError } from '../../shared/errors/AppError'
import { loadState, registerPersistence, schedulePersist } from '../../database/runtimeState'
import { appEvents } from '../../shared/events/appEvents'
import { lobbyConfig } from './lobby.config'
import { lobbyEvents } from './lobby.events'
import { lobbyRepository } from './lobby.repository'
import {
  bagreCandidates,
  countBagreVotes,
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
import type { QueueMode } from '../../shared/types/modes'
import { matchRepository } from '../matches/match.repository'
import { getRanking } from '../ranking/ranking.service'
import { seasonService } from '../seasons/season.service'
import { userRepository } from '../users/user.repository'

const timers = new Map<string, NodeJS.Timeout>()

// Os lobbies são guardados no banco a cada mudança, para sobreviver a um reinício do servidor.
// Mude STATE_VERSION quando o formato do Lobby mudar: estados guardados com outra versão são descartados.
const STATE_KEY = 'lobbies'
const STATE_VERSION = 1
// Depois de reiniciar, ninguém está conectado ainda: dá este tempo mínimo para as fases com prazo.
const RESTORE_GRACE_MS = 8_000
// Desloca as posições da season anterior para depois de qualquer posição da season atual (ver `seedPositions`).
const SEED_OFFSET = 10_000
registerPersistence(STATE_KEY, () => ({ version: STATE_VERSION, lobbies: lobbyRepository.all() }))

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
  schedulePersist(STATE_KEY)
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

// O que acontece quando o prazo da fase atual acaba (as mesmas ações de quando a fase começa).
// Fases sem prazo (partida, resultado, fim) devolvem null.
function timeoutAction(lobby: Lobby): (() => void) | null {
  switch (lobby.phase) {
    case 'voting':
      return () => finishVoting(lobby)
    case 'captains':
      return () => startCoinflip(lobby)
    case 'coinflip':
      return () => startSide(lobby)
    case 'side':
      return () => applySide(lobby, randomItem<Side>(['blue', 'red']))
    case 'picking':
      return () => autoPick(lobby)
    case 'done':
      return () => startPlaying(lobby)
    case 'mvp':
      return () => finishMvp(lobby)
    case 'bagre':
      return () => finishBagre(lobby)
    case 'rematch':
      return () => startRematch(lobby)
    default:
      return null
  }
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

// Modo tabela: os mais bem colocados na tabela entre os jogadores do lobby viram capitães.
// Quem ainda não tem posição (nunca jogou) fica por último; se precisar, as vagas são sorteadas entre eles.
function pickCaptainsByRanking(lobby: Lobby): number[] {
  const seeds = lobby.seedPositions ?? lobby.rankPositions
  const position = (id: number) => seeds.get(id) ?? Number.POSITIVE_INFINITY
  return shuffle(lobby.players)
    .sort((a, b) => position(a.userId) - position(b.userId))
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

// ---- Partida: em andamento -> votação do vencedor -> MVP -> bagre -> salva no histórico ----

function startPlaying(lobby: Lobby) {
  lobby.startedAt = Date.now()
  setPhase(lobby, 'playing', null)
}

function settleResult(lobby: Lobby, outcome: MatchOutcome) {
  lobby.outcome = outcome
  // Remake não tem vencedor, MVP nem bagre.
  if (outcome === 'remake') finishMatch(lobby)
  else setPhase(lobby, 'mvp', lobbyConfig.mvpMs, () => finishMvp(lobby))
}

// O mais votado leva (MVP ou bagre); empate é sorteado; sem nenhum voto, ninguém leva.
function mostVoted(counts: Map<number, number>): number | null {
  if (counts.size === 0) return null
  const top = Math.max(...counts.values())
  return randomItem([...counts].filter(([, n]) => n === top).map(([id]) => id))
}

function finishMvp(lobby: Lobby) {
  lobby.mvpId = mostVoted(countMvpVotes(lobby))
  setPhase(lobby, 'bagre', lobbyConfig.bagreMs, () => finishBagre(lobby))
}

function finishBagre(lobby: Lobby) {
  lobby.bagreId = mostVoted(countBagreVotes(lobby))
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
  lobby.bagreVotes = new Map()
  lobby.bagreId = null
  lobby.rematchVotes = new Set()

  startPlaying(lobby)
}

// Jogadores de um lado, no formato usado pelas listas ao vivo (tela inicial e admin).
function teamSummary(lobby: Lobby, side: Side) {
  return lobby.teams[side].map((id) => {
    const p = lobby.players.find((x) => x.userId === id)!
    return { id, riotId: p.riotId, iconId: p.iconId, isCaptain: lobby.captains.includes(id) }
  })
}

// Resumo das partidas que acabaram de terminar (vencedor, MVP, bagre). Fica na lista ao vivo
// por alguns segundos depois do fim. Só em memória: some ao reiniciar o servidor.
const RECENT_RESULT_MS = 15_000
const recentResults: {
  lobbyId: string
  matchId: string
  mode: QueueMode
  gameNumber: number
  outcome: MatchOutcome
  startedAt: number | null
  endedAt: number
  finishedAt: number
  mvpId: number | null
  bagreId: number | null
  teams: Record<Side, ReturnType<typeof teamSummary>>
}[] = []

function recentResultsList() {
  const cutoff = Date.now() - RECENT_RESULT_MS
  while (recentResults.length > 0 && recentResults[recentResults.length - 1].finishedAt < cutoff) recentResults.pop()
  return recentResults.map((r) => ({ ...r, expiresAt: r.finishedAt + RECENT_RESULT_MS }))
}

function finishMatch(lobby: Lobby) {
  try {
    matchRepository.save({
      id: lobby.matchId,
      mode: lobby.mode,
      seasonId: seasonService.current().id,
      startedAt: lobby.startedAt ?? lobby.createdAt,
      endedAt: lobby.endedAt ?? Date.now(),
      outcome: lobby.outcome!,
      mvpId: lobby.mvpId,
      bagreId: lobby.bagreId,
      votes: [
        ...[...lobby.mvpVotes].map(([voterId, targetId]) => ({ kind: 'mvp' as const, voterId, targetId })),
        ...[...lobby.bagreVotes].map(([voterId, targetId]) => ({ kind: 'bagre' as const, voterId, targetId })),
      ],
      players: lobby.players.map((p) => {
        const pick = lobby.picks.find((pk) => pk.playerId === p.userId)
        return {
          userId: p.userId,
          side: lobby.teams.blue.includes(p.userId) ? ('blue' as const) : ('red' as const),
          isCaptain: lobby.captains.includes(p.userId),
          pickOrder: pick?.order ?? null,
          pickedBy: pick?.byId ?? null,
        }
      }),
    })
  } catch (err) {
    // Não trava os jogadores se o banco falhar; o resultado ainda aparece na tela.
    console.error('Falha ao salvar a partida no histórico:', err)
  }
  recentResults.unshift({
    lobbyId: lobby.id,
    matchId: lobby.matchId,
    mode: lobby.mode,
    gameNumber: lobby.gameNumber,
    outcome: lobby.outcome!,
    startedAt: lobby.startedAt,
    endedAt: lobby.endedAt ?? Date.now(),
    finishedAt: Date.now(),
    mvpId: lobby.mvpId,
    bagreId: lobby.bagreId,
    teams: { blue: teamSummary(lobby, 'blue'), red: teamSummary(lobby, 'red') },
  })
  setPhase(lobby, 'finished', null)
}

// Fecha o lobby para todos, avisando o motivo (quem causou o cancelamento não recebe aviso).
function cancelLobby(lobby: Lobby, notice: string, causedBy?: number) {
  clearTimer(lobby.id)
  schedulePersist(STATE_KEY)
  for (const player of lobby.players) {
    if (lobby.left.has(player.userId)) continue
    sendTo(player.userId, { lobby: null, notice: player.userId === causedBy ? undefined : notice })
  }
  lobbyRepository.delete(lobby)
  appEvents.emit('lobby:left', lobby.players.map((p) => p.userId))
}

// Da partida começar até o histórico ser salvo: ninguém sai e o admin pode forçar o resultado.
function inMatch(lobby: Lobby) {
  return lobby.phase === 'playing' || lobby.phase === 'result' || lobby.phase === 'mvp' || lobby.phase === 'bagre'
}

function requireLobby(userId: number): Lobby {
  const lobby = lobbyRepository.findByUser(userId)
  if (!lobby) throw new AppError('Você não está em um lobby.', 404)
  return lobby
}

export const lobbyService = {
  // Recupera os lobbies guardados e religa o relógio de cada fase. Devolve quantos voltaram.
  restore(): number {
    const saved = loadState<{ version: number; lobbies: Lobby[] }>(STATE_KEY)
    if (!saved || saved.version !== STATE_VERSION) return 0

    for (const lobby of saved.lobbies) {
      lobbyRepository.restore(lobby)
      const action = timeoutAction(lobby)
      if (action && lobby.endsAt !== null) {
        const remaining = Math.max(lobby.endsAt - Date.now(), RESTORE_GRACE_MS)
        lobby.endsAt = Date.now() + remaining
        timers.set(lobby.id, setTimeout(action, remaining))
      }
    }
    return saved.lobbies.length
  },

  create(players: LobbyPlayer[], mode: QueueMode = 'vote'): Lobby {
    // Posição de cada um na tabela agora (mostrada na tela e usada no modo tabela).
    const ranking = getRanking()
    const rankPositions = new Map(
      players.map((p) => [p.userId, ranking.find((e) => e.userId === p.userId)?.position ?? null] as const),
    )
    // Início de season: quase ninguém tem posição ainda. Para o modo tabela não virar sorteio puro, quem não jogou na
    // season atual entra pela posição da anterior, atrás de todos os que já têm posição agora.
    const previous = seasonService.previousPositions()
    const seedPositions = new Map(
      players.map((p) => {
        const now = rankPositions.get(p.userId) ?? null
        const before = previous.get(p.userId)
        return [p.userId, now ?? (before !== undefined ? SEED_OFFSET + before : null)] as const
      }),
    )

    const roles = new Map(
      players.map((p) => [p.userId, userRepository.findById(p.userId)?.roles ?? { main: null, secondary: null, worst: null }] as const),
    )

    const lobby: Lobby = {
      id: randomUUID(),
      mode,
      rankPositions,
      seedPositions,
      roles,
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
      bagreVotes: new Map(),
      bagreId: null,
      matchId: randomUUID(),
      gameNumber: 1,
      rematchVotes: new Set(),
      left: new Set(),
      createdAt: Date.now(),
    }
    lobbyRepository.create(lobby)

    if (mode === 'ranked') {
      // Sem votação: capitães pela tabela e já mostra o resultado antes do sorteio.
      lobby.captains = pickCaptainsByRanking(lobby)
      setPhase(lobby, 'captains', lobbyConfig.revealMs, () => startCoinflip(lobby))
    } else {
      setPhase(lobby, 'voting', lobbyConfig.voteMs, () => finishVoting(lobby))
    }
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

  // Voto do bagre (o pior da partida) entre os jogadores do time perdedor. Igual ao MVP, mas pode votar em si mesmo.
  voteBagre(userId: number, targetId: unknown): LobbySnapshot {
    const lobby = requireLobby(userId)
    if (lobby.phase !== 'bagre') throw new AppError('Não é o momento de votar no bagre.', 409)
    if (lobby.bagreVotes.has(userId)) throw new AppError('Você já votou. O voto não pode ser alterado.', 409)
    if (typeof targetId !== 'number' || !bagreCandidates(lobby).includes(targetId)) {
      throw new AppError('Esse jogador não é do time perdedor.', 400)
    }
    // No bagre vale votar em si mesmo (autocrítica).
    lobby.bagreVotes.set(userId, targetId)
    if (lobby.bagreVotes.size === lobby.players.length) finishBagre(lobby)
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
    if (inMatch(lobby)) {
      throw new AppError('A partida está em andamento. Termine-a para sair.', 409)
    }

    const leaver = lobby.players.find((p) => p.userId === userId)
    cancelLobby(lobby, `${leaver?.riotId} saiu e o lobby foi cancelado.`, userId)
  },

  // Lobbies abertos em qualquer etapa (votação, draft, partida...), para qualquer jogador logado acompanhar
  // da tela inicial (só leitura). Junto vão as que acabaram de terminar, com o resumo final, por alguns segundos.
  listLive() {
    const matches = lobbyRepository.all().map((lobby) => ({
      id: lobby.id,
      mode: lobby.mode,
      phase: lobby.phase,
      gameNumber: lobby.gameNumber,
      startedAt: lobby.startedAt,
      endedAt: lobby.endedAt,
      players: lobby.players
        .filter((p) => !lobby.left.has(p.userId))
        .map((p) => ({
          id: p.userId,
          riotId: p.riotId,
          iconId: p.iconId,
          team: lobby.teams.blue.includes(p.userId) ? ('blue' as const) : lobby.teams.red.includes(p.userId) ? ('red' as const) : null,
          isCaptain: lobby.captains.includes(p.userId),
        })),
      // Formato antigo (só quem já está em um time), para quem ainda roda o frontend anterior.
      teams: { blue: teamSummary(lobby, 'blue'), red: teamSummary(lobby, 'red') },
    }))
    return { matches, recent: recentResultsList() }
  },

  recentResults: recentResultsList,

  // ---- Admin ----

  listForAdmin() {
    return lobbyRepository.all().map((lobby) => ({
      id: lobby.id,
      mode: lobby.mode,
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

  // Encerra a partida em andamento com o resultado escolhido (sem MVP nem bagre) e salva no histórico.
  adminForceResult(lobbyId: string, outcome: unknown) {
    const lobby = lobbyRepository.findById(lobbyId)
    if (!lobby) throw new AppError('Lobby não encontrado.', 404)
    if (outcome !== 'blue' && outcome !== 'red' && outcome !== 'remake') throw new AppError('Resultado inválido.', 400)
    if (!inMatch(lobby)) {
      throw new AppError('Só dá para forçar o resultado de uma partida em andamento.', 409)
    }

    lobby.endedAt = lobby.endedAt ?? Date.now()
    lobby.outcome = outcome
    lobby.mvpId = null
    lobby.bagreId = null
    // Sem MVP nem bagre, os votos parciais também não são guardados.
    lobby.mvpVotes = new Map()
    lobby.bagreVotes = new Map()
    finishMatch(lobby)
  },

  subscribe(userId: number, req: Request, res: Response) {
    lobbyEvents.add(userId, res)
    sendTo(userId, { lobby: lobbyService.current(userId) })
    req.on('close', () => lobbyEvents.remove(userId, res))
  },
}
