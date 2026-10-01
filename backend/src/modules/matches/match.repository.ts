import db from '../../database/db'
import { resolveIconId } from '../../shared/utils/icons'
import type { AdminMatch, AdminMatchPlayerRow, HistoryRow, MatchOutcome, NewMatch, PlayerStats, RankingRow } from './match.types'

const insertMatch = db.prepare(
  'INSERT INTO matches (id, started_at, ended_at, duration_seconds, outcome, mvp_user_id) VALUES (?, ?, ?, ?, ?, ?)',
)
const insertPlayer = db.prepare(
  'INSERT INTO match_players (match_id, user_id, side, is_captain, result, is_mvp) VALUES (?, ?, ?, ?, ?, ?)',
)

// Tudo ou nada: a partida e os 10 jogadores são gravados na mesma transação.
const saveTransaction = db.transaction((match: NewMatch) => {
  const durationSeconds = Math.max(0, Math.round((match.endedAt - match.startedAt) / 1000))
  insertMatch.run(
    match.id,
    new Date(match.startedAt).toISOString(),
    new Date(match.endedAt).toISOString(),
    durationSeconds,
    match.outcome,
    match.mvpId,
  )

  for (const player of match.players) {
    const result = match.outcome === 'remake' ? 'remake' : player.side === match.outcome ? 'win' : 'loss'
    insertPlayer.run(match.id, player.userId, player.side, player.isCaptain ? 1 : 0, result, player.userId === match.mvpId ? 1 : 0)
  }
})

export const matchRepository = {
  save(match: NewMatch) {
    saveTransaction(match)
  },

  // Remakes não contam como jogo nem como vitória/derrota.
  statsForUser(userId: number): PlayerStats {
    const row = db
      .prepare(
        `SELECT
           COUNT(*) AS games,
           COALESCE(SUM(result = 'win'), 0) AS wins,
           COALESCE(SUM(result = 'loss'), 0) AS losses,
           COALESCE(SUM(is_mvp), 0) AS mvps
         FROM match_players
         WHERE user_id = ? AND result != 'remake'`,
      )
      .get(userId) as PlayerStats
    return row
  },

  // Todos os jogadores com pelo menos uma partida válida (sem remakes).
  rankingRows(): RankingRow[] {
    const rows = db
      .prepare(
        `SELECT
           u.id AS userId, u.game_name AS gameName, u.tag_line AS tagLine, u.profile_icon_id AS profileIconId,
           COUNT(*) AS games,
           SUM(mp.result = 'win') AS wins,
           SUM(mp.result = 'loss') AS losses,
           SUM(mp.is_mvp) AS mvps
         FROM match_players mp
         JOIN users u ON u.id = mp.user_id
         WHERE mp.result != 'remake'
         GROUP BY u.id`,
      )
      .all() as RankingRow[]
    return rows
  },

  // Partidas do jogador, da mais recente para a mais antiga (inclui remakes).
  historyForUser(userId: number, limit: number): HistoryRow[] {
    const rows = db
      .prepare(
        `SELECT
           m.id AS matchId, m.ended_at AS endedAt, m.duration_seconds AS durationSeconds,
           mp.side AS side, mp.result AS result, mp.is_captain AS isCaptain, mp.is_mvp AS isMvp
         FROM match_players mp
         JOIN matches m ON m.id = mp.match_id
         WHERE mp.user_id = ?
         ORDER BY m.ended_at DESC
         LIMIT ?`,
      )
      .all(userId, limit) as (Omit<HistoryRow, 'isCaptain' | 'isMvp'> & { isCaptain: number; isMvp: number })[]
    return rows.map((r) => ({ ...r, isCaptain: r.isCaptain === 1, isMvp: r.isMvp === 1 }))
  },

  // ---- Admin ----

  // Partidas mais recentes com os jogadores de cada uma.
  listRecent(limit: number): AdminMatch[] {
    const matches = db
      .prepare(
        `SELECT id, started_at AS startedAt, ended_at AS endedAt, duration_seconds AS durationSeconds,
                outcome, mvp_user_id AS mvpId
         FROM matches ORDER BY ended_at DESC LIMIT ?`,
      )
      .all(limit) as Omit<AdminMatch, 'players'>[]
    const playersOf = db.prepare(
      `SELECT mp.user_id AS userId, u.game_name AS gameName, u.tag_line AS tagLine, u.profile_icon_id AS profileIconId,
              mp.side, mp.is_captain AS isCaptain, mp.result
       FROM match_players mp LEFT JOIN users u ON u.id = mp.user_id
       WHERE mp.match_id = ?`,
    )
    return matches.map((m) => ({
      ...m,
      players: (playersOf.all(m.id) as AdminMatchPlayerRow[]).map((p) => ({
        userId: p.userId,
        riotId: p.gameName ? `${p.gameName}#${p.tagLine}` : `Conta removida (${p.userId})`,
        iconId: resolveIconId(p.userId, p.profileIconId),
        side: p.side,
        isCaptain: p.isCaptain === 1,
        result: p.result,
      })),
    }))
  },

  // Corrige o resultado de uma partida já salva. Se o MVP ficar no time perdedor (ou virar remake), o MVP é removido.
  updateOutcome(matchId: string, outcome: MatchOutcome): boolean {
    const update = db.transaction(() => {
      const match = db.prepare('SELECT mvp_user_id AS mvpId FROM matches WHERE id = ?').get(matchId) as
        | { mvpId: number | null }
        | undefined
      if (!match) return false

      let mvpId = match.mvpId
      if (mvpId !== null) {
        const mvpSide = (db.prepare('SELECT side FROM match_players WHERE match_id = ? AND user_id = ?').get(matchId, mvpId) as
          | { side: string }
          | undefined)?.side
        if (outcome === 'remake' || mvpSide !== outcome) mvpId = null
      }

      db.prepare('UPDATE matches SET outcome = ?, mvp_user_id = ? WHERE id = ?').run(outcome, mvpId, matchId)
      db.prepare(
        `UPDATE match_players
         SET result = CASE WHEN ? = 'remake' THEN 'remake' WHEN side = ? THEN 'win' ELSE 'loss' END,
             is_mvp = CASE WHEN user_id = ? THEN 1 ELSE 0 END
         WHERE match_id = ?`,
      ).run(outcome, outcome, mvpId, matchId)
      return true
    })
    return update()
  },

  delete(matchId: string): boolean {
    const remove = db.transaction(() => {
      db.prepare('DELETE FROM match_players WHERE match_id = ?').run(matchId)
      return db.prepare('DELETE FROM matches WHERE id = ?').run(matchId).changes > 0
    })
    return remove()
  },
}
