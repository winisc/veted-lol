import db from '../../database/db'
import { matchRepository } from '../matches/match.repository'
import { buildRanking } from '../ranking/ranking.builder'
import { seasonRepository, type Season } from './season.repository'

// Cada season dura SEASON_DAYS dias (padrão 7). Quando uma acaba, a tabela dela é congelada e a próxima começa
// no mesmo instante. A primeira season começa na primeira vez que o servidor sobe com este código; tudo o que
// existia antes vira a season 0 (a tabela antiga).
const DAY_MS = 24 * 60 * 60 * 1000
const SEASON_MS = Math.max(1, Number(process.env.SEASON_DAYS) || 7) * DAY_MS
const EPOCH = new Date(0).toISOString()
const CHECK_EVERY_MS = 60_000

// Congela a tabela de uma season: guarda a posição final de cada jogador e a marca como encerrada.
function closeSeason(season: Season) {
  seasonRepository.saveStandings(season.id, buildRanking(matchRepository.rankingRows(season.id)))
  seasonRepository.close(season.id)
}

// Garante que existe uma season atual e fecha as que já passaram do prazo. Barato: serve para chamar a cada leitura.
export function ensureSeasons(now = Date.now()): Season {
  let current: Season | null = seasonRepository.current()

  db.transaction(() => {
    if (!current) {
      // Primeira vez: as partidas de antes (sem season) viram a season 0, arquivada, e a season 1 começa agora.
      const startsAt = new Date(now).toISOString()
      seasonRepository.create({ id: 0, startsAt: EPOCH, endsAt: startsAt })
      closeSeason({ id: 0, startsAt: EPOCH, endsAt: startsAt, closed: false })
      current = { id: 1, startsAt, endsAt: new Date(now + SEASON_MS).toISOString(), closed: false }
      seasonRepository.create(current)
      console.log('Seasons ativadas: a tabela antiga virou a season 0 e a season 1 começou agora.')
    }

    // Prazo vencido: fecha e abre a próxima, começando exatamente quando a anterior acabou (sem deslizar o relógio).
    while (now >= Date.parse(current.endsAt)) {
      closeSeason(current)
      const startsAt: string = current.endsAt
      current = { id: current.id + 1, startsAt, endsAt: new Date(Date.parse(startsAt) + SEASON_MS).toISOString(), closed: false }
      seasonRepository.create(current)
      console.log(`Season ${current.id - 1} encerrada. Season ${current.id} começou.`)
    }
  })()

  return current!
}

export const seasonService = {
  current: () => ensureSeasons(),

  // Seasons para mostrar: a atual e as encerradas que tiveram jogadores (seasons vazias ficam de fora).
  list(): Season[] {
    const current = ensureSeasons()
    return [current, ...seasonRepository.closedWithStandings()]
  },

  // Posição de cada jogador na última season encerrada que teve tabela (usada para desempatar quem ainda não jogou na atual).
  previousPositions(): Map<number, number> {
    const [previous] = seasonRepository.closedWithStandings()
    const positions = new Map<number, number>()
    if (previous) for (const e of seasonRepository.standings(previous.id)) positions.set(e.userId, e.position)
    return positions
  },
}

// Confere a virada de season de tempos em tempos (e já na hora de ligar).
export function startSeasonScheduler() {
  ensureSeasons()
  setInterval(() => {
    try {
      ensureSeasons()
    } catch (err) {
      console.error('Falha ao virar a season:', err)
    }
  }, CHECK_EVERY_MS).unref()
}
