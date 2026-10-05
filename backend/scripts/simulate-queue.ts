// Simula jogadores na fila e no lobby para testar sem precisar de 10 pessoas.
//
//   npm run sim:queue                  -> 9 bots na fila (você entra como o 10º)
//   npm run sim:queue -- --count=4     -> outra quantidade de bots
//   npm run sim:queue -- --mode=ranked -> bots na fila do modo tabela (padrão: modo capitão)
//   npm run sim:queue -- --match-seconds=60  -> duração da partida antes de os bots a encerrarem (padrão 20)
//   npm run sim:queue -- --clean       -> apaga as contas dos bots e as partidas de teste do histórico
//
// O backend precisa estar rodando. Mantenha este script aberto: os bots saem da fila quando ele fecha (Ctrl+C).
// No lobby, os bots votam em alguém aleatório e, se forem capitães, escolhem o lado e fazem os picks.
// Na partida, encerram, votam no vencedor, no MVP e no bagre. Na tela final, topam a revanche depois que VOCÊ votar.
// Quando você sai (ou se o lobby for cancelado), os bots voltam para a fila.
// ATENÇÃO: partidas jogadas com bots são salvas no histórico. Use --clean para apagá-las.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import db from '../src/database/db'
import { userRepository } from '../src/modules/users/user.repository'

const TAG = 'SIM'
const PASSWORD = 'bot-senha-123'
const BASE = `http://localhost:${process.env.PORT || 3333}/api`
const JOIN_DELAY_MS = 400
const REJOIN_DELAY_MS = 2000
const VOTE_DELAY_RANGE_MS: [number, number] = [1500, 8000]
const ACTION_DELAY_RANGE_MS: [number, number] = [1500, 4000] // escolher lado e fazer picks

const args = process.argv.slice(2)
const count = Number(args.find((a) => a.startsWith('--count='))?.split('=')[1]) || 9
// Quanto tempo a partida dura antes de os bots votarem para encerrá-la.
const MATCH_SECONDS = Number(args.find((a) => a.startsWith('--match-seconds='))?.split('=')[1]) || 20
// Fila em que os bots entram: vote (capitães por votação, padrão) ou ranked (capitães pela tabela).
const MODE = args.find((a) => a.startsWith('--mode='))?.split('=')[1] === 'ranked' ? 'ranked' : 'vote'

interface LobbyPlayer {
  id: number
  isCaptain: boolean
  team: 'blue' | 'red' | null
}
interface LobbySnapshot {
  id: string
  phase: 'voting' | 'captains' | 'coinflip' | 'side' | 'picking' | 'done' | 'playing' | 'result' | 'mvp' | 'bagre' | 'finished' | 'rematch'
  players: LobbyPlayer[]
  draft: { currentTurnId: number | null; pickIndex: number }
  match: { mvpCandidates: number[]; bagreCandidates: number[]; gameNumber: number; rematchVotes: number; rematchAvailable: boolean }
}

interface Bot {
  id: number
  riotId: string
  token: string
  lobbyId: string | null
  acted: Set<string> // ações já agendadas, para não repetir a cada evento do lobby
  accepting: boolean // aceite da partida em andamento
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const randomBetween = ([min, max]: [number, number]) => min + Math.random() * (max - min)

async function post<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

async function login(riotId: string): Promise<{ token: string; id: number }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ riotId, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login ${riotId} -> ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { token: string; user: { id: number } }
  return { token: data.token, id: data.user.id }
}

// Abre um canal SSE e chama onEvent para cada mensagem.
// Manter o canal da fila aberto é o que evita o servidor remover o bot da fila após 15s.
async function stream(path: string, token: string, onEvent: (data: any) => void) {
  const res = await fetch(`${BASE}${path}?access_token=${token}`)
  if (!res.ok || !res.body) throw new Error(`${path} -> ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  ;(async () => {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return
      buffer += decoder.decode(value)
      let end: number
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        if (chunk.startsWith('data: ')) onEvent(JSON.parse(chunk.slice(6)))
      }
    }
  })().catch(() => {})
}

async function joinQueue(bot: Bot) {
  const snap = await post<{ size: number; required: number }>('/queue/join', bot.token, { mode: MODE })
  console.log(`  ${bot.riotId} entrou na fila ${MODE === 'ranked' ? 'da tabela' : 'da votação'} (${snap.size}/${snap.required})`)
}

function onLobbyEvent(bot: Bot, lobby: LobbySnapshot | null) {
  if (!lobby) {
    // Saiu de um lobby (cancelado): volta para a fila.
    if (bot.lobbyId) {
      bot.lobbyId = null
      setTimeout(() => joinQueue(bot).catch((e) => console.error(e.message)), REJOIN_DELAY_MS)
    }
    return
  }

  bot.lobbyId = lobby.id

  // Cada ação só é agendada uma vez por lobby/partida/fase/pick; falhas são ignoradas (o tempo pode ter acabado).
  // O número da partida entra na chave porque na revanche o mesmo lobby joga de novo.
  const act = (key: string, path: string, body: unknown, delay: [number, number]) => {
    const actionKey = `${lobby.id}:${lobby.match.gameNumber}:${key}`
    if (bot.acted.has(actionKey)) return
    bot.acted.add(actionKey)
    setTimeout(() => post(path, bot.token, body).catch(() => {}), randomBetween(delay))
  }
  const random = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]
  const myTurn = lobby.draft.currentTurnId === bot.id

  if (lobby.phase === 'voting') {
    act('vote', '/lobby/vote', { targetId: random(lobby.players).id }, VOTE_DELAY_RANGE_MS)
  } else if (lobby.phase === 'side' && myTurn) {
    act('side', '/lobby/side', { side: random(['blue', 'red']) }, ACTION_DELAY_RANGE_MS)
  } else if (lobby.phase === 'picking' && myTurn) {
    const pool = lobby.players.filter((p) => p.team === null)
    act(`pick${lobby.draft.pickIndex}`, '/lobby/pick', { playerId: random(pool).id }, ACTION_DELAY_RANGE_MS)
  } else if (lobby.phase === 'playing') {
    // Cada bot declara o fim da partida depois de ~MATCH_SECONDS (varia um pouco entre eles).
    act('end', '/lobby/end', { vote: true }, [MATCH_SECONDS * 750, MATCH_SECONDS * 1250])
  } else if (lobby.phase === 'result') {
    // Todos os bots votam no mesmo vencedor (definido pelo id do lobby) para o resultado fechar.
    const winner = (parseInt(lobby.id.slice(0, 2), 16) + lobby.match.gameNumber) % 2 === 0 ? 'blue' : 'red'
    act('result', '/lobby/result', { choice: winner }, ACTION_DELAY_RANGE_MS)
  } else if (lobby.phase === 'mvp') {
    const candidates = lobby.match.mvpCandidates.filter((id) => id !== bot.id)
    if (candidates.length > 0) act('mvp', '/lobby/mvp', { targetId: random(candidates) }, ACTION_DELAY_RANGE_MS)
  } else if (lobby.phase === 'bagre') {
    const candidates = lobby.match.bagreCandidates.filter((id) => id !== bot.id)
    if (candidates.length > 0) act('bagre', '/lobby/bagre', { targetId: random(candidates) }, ACTION_DELAY_RANGE_MS)
  } else if (lobby.phase === 'finished') {
    if (!lobby.match.rematchAvailable) {
      // Alguém (você) saiu: acabou. O bot sai e (pelo evento "sem lobby" acima) volta para a fila.
      act('leave', '/lobby/leave', undefined, [1000, 3000])
    } else if (lobby.match.rematchVotes > 0) {
      // Os bots só topam a revanche depois que um jogador de verdade votou, para você decidir.
      act('rematch', '/lobby/rematch', { vote: true }, [1000, 4000])
    }
  }
}

async function ensureBotUsers(): Promise<string[]> {
  const hash = await bcrypt.hash(PASSWORD, 10)
  const ids: string[] = []
  for (let i = 1; i <= count; i++) {
    const riot = { gameName: `Bot${String(i).padStart(2, '0')}`, tagLine: TAG }
    const user = userRepository.findByRiotId(riot) ?? userRepository.create(riot, hash)
    // A fila exige as 3 roles no perfil: cada bot recebe roles diferentes (em rodízio).
    const order = ['top', 'jungle', 'mid', 'adc', 'support'] as const
    userRepository.setRoles(user.id, { main: order[i % 5], secondary: order[(i + 1) % 5], worst: order[(i + 3) % 5] })
    ids.push(`${riot.gameName}#${TAG}`)
  }
  return ids
}

async function main() {
  if (args.includes('--clean')) {
    // Partidas com bots são de teste: somem do histórico (inclusive as linhas de quem jogou com eles),
    // senão contariam nas vitórias/derrotas/MVPs/bagres dos jogadores reais.
    const clean = db.transaction(() => {
      const isBot = "SELECT id FROM users WHERE tag_line = ? COLLATE NOCASE"
      const testMatches = `SELECT match_id FROM match_players WHERE user_id IN (${isBot})`
      const deletedPlayers = db.prepare(`DELETE FROM match_players WHERE match_id IN (${testMatches})`).run(TAG).changes
      const deletedMatches = db.prepare('DELETE FROM matches WHERE id NOT IN (SELECT match_id FROM match_players)').run().changes
      const deletedUsers = db.prepare('DELETE FROM users WHERE tag_line = ? COLLATE NOCASE').run(TAG).changes
      return { deletedPlayers, deletedMatches, deletedUsers }
    })
    const r = clean()
    console.log(`${r.deletedUsers} conta(s) de bot removida(s), ${r.deletedMatches} partida(s) de teste apagada(s) do histórico.`)
    return
  }

  try {
    await fetch(`${BASE}/health`)
  } catch {
    console.error(`Backend não respondeu em ${BASE}. Rode "npm run dev" no backend primeiro.`)
    process.exit(1)
  }

  const bots: Bot[] = []
  for (const riotId of await ensureBotUsers()) {
    bots.push({ riotId, ...(await login(riotId)), lobbyId: null, acted: new Set(), accepting: false })
  }

  console.log(`Colocando ${bots.length} bots na fila...`)
  for (const bot of bots) {
    // Bots aceitam a partida sozinhos (depois de um instante) quando a fila fecha.
    await stream('/queue/events', bot.token, (data) => {
      if (data.status !== 'ready_check' || data.readyCheck?.iAccepted || bot.accepting) return
      bot.accepting = true
      setTimeout(() => {
        post('/queue/accept', bot.token)
          .catch(() => {})
          .finally(() => (bot.accepting = false))
      }, randomBetween([500, 2500]))
    })
    await stream('/lobby/events', bot.token, (data) => onLobbyEvent(bot, data.lobby))
  }
  for (const bot of bots) {
    // Sobra de uma execução anterior (ex.: lobby terminado que ficou aberto): sai antes de entrar na fila.
    await post('/lobby/leave', bot.token).catch(() => {})
    await joinQueue(bot)
    await sleep(JOIN_DELAY_MS)
  }
  console.log('\nPronto! Entre na fila pelo site. Ctrl+C para encerrar.\n')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
