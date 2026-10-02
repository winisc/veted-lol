import db from '../../database/db'
import { resolveIconId } from '../../shared/utils/icons'
import type { AdminMatch, AdminMatchPlayerRow, HistoryRow, MatchOutcome, NewMatch, PlayerStats, RankingRow } from './match.types'

const insertMatch = db.prepare(
  'INSERT INTO matches (id, mode, started_at, ended_at, duration_seconds, outcome, mvp_user_id, bagre_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
)
const insertPlayer = db.prepare(
  'INSERT INTO match_players (match_id, user_id, side, is_captain, result, is_mvp, is_bagre) VALUES (?, ?, ?, ?, ?, ?, ?)',
)

// Tudo ou nada: a partida e os 10 jogadores são gravados na mesma transação.
const saveTransaction = db.transaction((match: NewMatch) => {
  const durationSeconds = Math.max(0, Math.round((match.endedAt - match.startedAt) / 1000))
  insertMatch.run(
    match.id,
    match.mode,
    new Date(match.startedAt).toISOString(),
    new Date(match.endedAt).toISOString(),
    durationSeconds,
    match.outcome,
    match.mvpId,
    match.bagreId,
  )

  for (const player of match.players) {
    const result = match.outcome === 'remake' ? 'remake' : player.side === match.outcome ? 'win' : 'loss'
    insertPlayer.run(
      match.id,
      player.userId,
      player.side,
      player.isCaptain ? 1 : 0,
      result,
      player.userId === match.mvpId ? 1 : 0,
      player.userId === match.bagreId ? 1 : 0,
    )
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
           COALESCE(SUM(is_mvp), 0) AS mvps,
           COALESCE(SUM(is_bagre), 0) AS bagres
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
           SUM(mp.is_mvp) AS mvps,
           SUM(mp.is_bagre) AS bagres
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
           mp.side AS side, mp.result AS result, mp.is_captain AS isCaptain, mp.is_mvp AS isMvp,
           mp.is_bagre AS isBagre
         FROM match_players mp
         JOIN matches m ON m.id = mp.match_id
         WHERE mp.user_id = ?
         ORDER BY m.ended_at DESC
         LIMIT ?`,
      )
      .all(userId, limit) as (Omit<HistoryRow, 'isCaptain' | 'isMvp' | 'isBagre'> & {
      isCaptain: number
      isMvp: number
      isBagre: number
    })[]
    return rows.map((r) => ({ ...r, isCaptain: r.isCaptain === 1, isMvp: r.isMvp === 1, isBagre: r.isBagre === 1 }))
  },

  // ---- Admin ----

  // Partidas mais recentes com os jogadores de cada uma.
  listRecent(limit: number): AdminMatch[] {
    const matches = db
      .prepare(
        `SELECT id, mode, started_at AS startedAt, ended_at AS endedAt, duration_seconds AS durationSeconds,
                outcome, mvp_user_id AS mvpId, bagre_user_id AS bagreId
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

  // Corrige o resultado de uma partida já salva. Se o MVP ficar no time perdedor, ou o bagre no vencedor
  // (ou a partida virar remake), ele é removido.
  updateOutcome(matchId: string, outcome: MatchOutcome): boolean {
    const update = db.transaction(() => {
      const match = db
        .prepare('SELECT mvp_user_id AS mvpId, bagre_user_id AS bagreId FROM matches WHERE id = ?')
        .get(matchId) as { mvpId: number | null; bagreId: number | null } | undefined
      if (!match) return false

      const sideOf = (userId: number) =>
        (db.prepare('SELECT side FROM match_players WHERE match_id = ? AND user_id = ?').get(matchId, userId) as
          | { side: string }
          | undefined)?.side
      const decided = outcome !== 'remake'
      const mvpId = match.mvpId !== null && decided && sideOf(match.mvpId) === outcome ? match.mvpId : null
      const bagreId = match.bagreId !== null && decided && sideOf(match.bagreId) !== outcome ? match.bagreId : null

      db.prepare('UPDATE matches SET outcome = ?, mvp_user_id = ?, bagre_user_id = ? WHERE id = ?').run(
        outcome,
        mvpId,
        bagreId,
        matchId,
      )
      db.prepare(
        `UPDATE match_players
         SET result = CASE WHEN ? = 'remake' THEN 'remake' WHEN side = ? THEN 'win' ELSE 'loss' END,
             is_mvp = CASE WHEN user_id = ? THEN 1 ELSE 0 END,
             is_bagre = CASE WHEN user_id = ? THEN 1 ELSE 0 END
         WHERE match_id = ?`,
      ).run(outcome, outcome, mvpId, bagreId, matchId)
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
