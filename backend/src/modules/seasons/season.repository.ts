import db from '../../database/db'
import { resolveIconId } from '../../shared/utils/icons'
import { formatRiotId } from '../../shared/utils/riotId'
import { winRate } from '../matches/match.scoring'
import { zoneFor } from '../ranking/ranking.zones'
import type { RankingEntry } from '../ranking/ranking.builder'

export interface Season {
  id: number
  startsAt: string // ISO 8601, UTC
  endsAt: string
  closed: boolean
}

interface SeasonRow {
  id: number
  starts_at: string
  ends_at: string
  closed: number
}

const toSeason = (row: SeasonRow): Season => ({ id: row.id, startsAt: row.starts_at, endsAt: row.ends_at, closed: row.closed === 1 })

export const seasonRepository = {
  // A season atual é sempre a de maior número.
  current(): Season | null {
    const row = db.prepare('SELECT * FROM seasons ORDER BY id DESC LIMIT 1').get() as SeasonRow | undefined
    return row ? toSeason(row) : null
  },

  findById(id: number): Season | null {
    const row = db.prepare('SELECT * FROM seasons WHERE id = ?').get(id) as SeasonRow | undefined
    return row ? toSeason(row) : null
  },

  create(season: Omit<Season, 'closed'> & { closed?: boolean }) {
    db.prepare('INSERT INTO seasons (id, starts_at, ends_at, closed) VALUES (?, ?, ?, ?)').run(
      season.id,
      season.startsAt,
      season.endsAt,
      season.closed ? 1 : 0,
    )
  },

  close(id: number) {
    db.prepare('UPDATE seasons SET closed = 1 WHERE id = ?').run(id)
  },

  // Seasons encerradas que tiveram pelo menos um jogador na tabela, da mais recente para a mais antiga.
  closedWithStandings(): Season[] {
    const rows = db
      .prepare(
        `SELECT s.* FROM seasons s
         WHERE s.closed = 1 AND EXISTS (SELECT 1 FROM season_standings st WHERE st.season_id = s.id)
         ORDER BY s.id DESC`,
      )
      .all() as SeasonRow[]
    return rows.map(toSeason)
  },

  saveStandings(seasonId: number, entries: RankingEntry[]) {
    const insert = db.prepare(
      `INSERT OR REPLACE INTO season_standings (season_id, user_id, position, points, games, wins, losses, mvps, bagres)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const e of entries) insert.run(seasonId, e.userId, e.position, e.points, e.games, e.wins, e.losses, e.mvps, e.bagres)
  },

  // Tabela congelada de uma season encerrada, já no formato da tabela normal.
  standings(seasonId: number): RankingEntry[] {
    const rows = db
      .prepare(
        `SELECT st.user_id AS userId, st.position, st.points, st.games, st.wins, st.losses, st.mvps, st.bagres,
                u.game_name AS gameName, u.tag_line AS tagLine, u.profile_icon_id AS profileIconId
         FROM season_standings st LEFT JOIN users u ON u.id = st.user_id
         WHERE st.season_id = ? ORDER BY st.position`,
      )
      .all(seasonId) as {
      userId: number
      position: number
      points: number
      games: number
      wins: number
      losses: number
      mvps: number
      bagres: number
      gameName: string | null
      tagLine: string | null
      profileIconId: number | null
    }[]
    return rows.map((r) => ({
      position: r.position,
      zone: zoneFor(r.position, rows.length),
      userId: r.userId,
      riotId: r.gameName ? formatRiotId(r.gameName, r.tagLine ?? '') : `Conta removida (${r.userId})`,
      iconId: resolveIconId(r.userId, r.profileIconId),
      points: r.points,
      games: r.games,
      wins: r.wins,
      losses: r.losses,
      winRate: winRate(r.wins, r.losses),
      mvps: r.mvps,
      bagres: r.bagres,
    }))
  },
}
