import db from '../../database/db'
import { resolveIconId } from '../../shared/utils/icons'
import { formatRiotId } from '../../shared/utils/riotId'
import { LEGACY_SEASON_ID } from '../seasons/season.constants'
import type { AdminMatch, AdminMatchPlayerRow, MatchDetail, MatchVote, PlayerResult, Rival, HistoryRow, MatchOutcome, NewMatch, PlayerStats, RankingRow } from './match.types'

const insertMatch = db.prepare(
  'INSERT INTO matches (id, mode, season_id, started_at, ended_at, duration_seconds, outcome, mvp_user_id, bagre_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
)
const insertPlayer = db.prepare(
  'INSERT INTO match_players (match_id, user_id, side, is_captain, result, is_mvp, is_bagre, pick_order, picked_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
)
const insertVote = db.prepare('INSERT INTO match_votes (match_id, kind, voter_id, target_id) VALUES (?, ?, ?, ?)')

// Tudo ou nada: a partida e os 10 jogadores são gravados na mesma transação.
const saveTransaction = db.transaction((match: NewMatch) => {
  const durationSeconds = Math.max(0, Math.round((match.endedAt - match.startedAt) / 1000))
  insertMatch.run(
    match.id,
    match.mode,
    match.seasonId,
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
      player.pickOrder,
      player.pickedBy,
    )
  }
  for (const vote of match.votes) insertVote.run(match.id, vote.kind, vote.voterId, vote.targetId)
})

// Filtro opcional por season (a partida sem season, de antes das seasons, vale como a season antiga).
const SEASON_FILTER_SQL = `(? IS NULL OR COALESCE(m.season_id, ${LEGACY_SEASON_ID}) = ?)`

export const matchRepository = {
  save(match: NewMatch) {
    saveTransaction(match)
  },

  // Remakes não contam como jogo nem como vitória/derrota. Com `seasonId`, só as partidas dessa season.
  statsForUser(userId: number, seasonId?: number): PlayerStats {
    const row = db
      .prepare(
        `SELECT
           COUNT(*) AS games,
           COALESCE(SUM(mp.result = 'win'), 0) AS wins,
           COALESCE(SUM(mp.result = 'loss'), 0) AS losses,
           COALESCE(SUM(mp.is_mvp), 0) AS mvps,
           COALESCE(SUM(mp.is_bagre), 0) AS bagres
         FROM match_players mp JOIN matches m ON m.id = mp.match_id
         WHERE mp.user_id = ? AND mp.result != 'remake' AND (? IS NULL OR COALESCE(m.season_id, ${LEGACY_SEASON_ID}) = ?)`,
      )
      .get(userId, seasonId ?? null, seasonId ?? null) as PlayerStats
    return row
  },

  // Todos os jogadores com pelo menos uma partida válida (sem remakes). Com `seasonId`, só as dessa season.
  rankingRows(seasonId?: number): RankingRow[] {
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
         JOIN matches m ON m.id = mp.match_id
         JOIN users u ON u.id = mp.user_id
         WHERE mp.result != 'remake' AND (? IS NULL OR COALESCE(m.season_id, ${LEGACY_SEASON_ID}) = ?)
         GROUP BY u.id`,
      )
      .all(seasonId ?? null, seasonId ?? null) as RankingRow[]
    return rows
  },

  // Partidas do jogador, da mais recente para a mais antiga (inclui remakes).
  historyForUser(userId: number, limit: number): HistoryRow[] {
    const rows = db
      .prepare(
        `SELECT
           m.id AS matchId, m.ended_at AS endedAt, m.duration_seconds AS durationSeconds,
           mp.side AS side, mp.result AS result, mp.is_captain AS isCaptain, mp.is_mvp AS isMvp,
           mp.is_bagre AS isBagre, COALESCE(m.season_id, ${LEGACY_SEASON_ID}) AS seasonId
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

  // ---- Detalhe da partida e estatísticas ----

  findDetail(matchId: string): MatchDetail | null {
    const match = db
      .prepare(
        `SELECT id, mode, started_at AS startedAt, ended_at AS endedAt, duration_seconds AS durationSeconds,
                outcome, mvp_user_id AS mvpId, bagre_user_id AS bagreId
         FROM matches WHERE id = ?`,
      )
      .get(matchId) as Omit<MatchDetail, 'players' | 'hasVotes'> | undefined
    if (!match) return null

    const rows = db
      .prepare(
        `SELECT mp.user_id AS userId, u.game_name AS gameName, u.tag_line AS tagLine, u.profile_icon_id AS profileIconId,
                mp.side, mp.is_captain AS isCaptain, mp.result, mp.pick_order AS pickOrder, mp.picked_by AS pickedBy
         FROM match_players mp LEFT JOIN users u ON u.id = mp.user_id
         WHERE mp.match_id = ?`,
      )
      .all(matchId) as (AdminMatchPlayerRow & { pickOrder: number | null; pickedBy: number | null })[]

    // Só a contagem de votos por jogador (quem votou em quem é só do admin).
    const votes = db
      .prepare('SELECT kind, target_id AS targetId, COUNT(*) AS n FROM match_votes WHERE match_id = ? GROUP BY kind, target_id')
      .all(matchId) as { kind: string; targetId: number; n: number }[]
    const countFor = (kind: string, userId: number) => votes.find((v) => v.kind === kind && v.targetId === userId)?.n ?? 0

    return {
      ...match,
      hasVotes: votes.length > 0,
      players: rows.map((p) => ({
        userId: p.userId,
        riotId: p.gameName ? formatRiotId(p.gameName, p.tagLine ?? '') : `Conta removida (${p.userId})`,
        iconId: resolveIconId(p.userId, p.profileIconId),
        side: p.side,
        isCaptain: p.isCaptain === 1,
        result: p.result,
        pickOrder: p.pickOrder,
        pickedBy: p.pickedBy,
        mvpVotes: countFor('mvp', p.userId),
        bagreVotes: countFor('bagre', p.userId),
      })),
    }
  },

  // Resultados do jogador, do mais recente para o mais antigo (sem remakes), para as sequências. Com `seasonId`, só dessa season.
  resultsForUser(userId: number, seasonId?: number): ('win' | 'loss')[] {
    const rows = db
      .prepare(
        `SELECT mp.result AS result
         FROM match_players mp JOIN matches m ON m.id = mp.match_id
         WHERE mp.user_id = ? AND mp.result != 'remake' AND %s
         ORDER BY m.ended_at DESC`.replace('%s', SEASON_FILTER_SQL),
      )
      .all(userId, seasonId ?? null, seasonId ?? null) as { result: PlayerResult }[]
    return rows.map((r) => r.result as 'win' | 'loss')
  },

  // Números do jogador separados por season (remakes não contam), para somar a carreira respeitando a pontuação de cada época.
  statsBySeason(userId: number): (PlayerStats & { seasonId: number })[] {
    return db
      .prepare(
        `SELECT COALESCE(m.season_id, ${LEGACY_SEASON_ID}) AS seasonId,
                COUNT(*) AS games,
                COALESCE(SUM(mp.result = 'win'), 0) AS wins,
                COALESCE(SUM(mp.result = 'loss'), 0) AS losses,
                COALESCE(SUM(mp.is_mvp), 0) AS mvps,
                COALESCE(SUM(mp.is_bagre), 0) AS bagres
         FROM match_players mp JOIN matches m ON m.id = mp.match_id
         WHERE mp.user_id = ? AND mp.result != 'remake'
         GROUP BY seasonId`,
      )
      .all(userId) as (PlayerStats & { seasonId: number })[]
  },

  captainStats(userId: number, seasonId?: number): { games: number; wins: number } {
    return db
      .prepare(
        `SELECT COUNT(*) AS games, COALESCE(SUM(mp.result = 'win'), 0) AS wins
         FROM match_players mp JOIN matches m ON m.id = mp.match_id
         WHERE mp.user_id = ? AND mp.is_captain = 1 AND mp.result != 'remake' AND %s`.replace('%s', SEASON_FILTER_SQL),
      )
      .get(userId, seasonId ?? null, seasonId ?? null) as { games: number; wins: number }
  },

  // Contra quem o jogador já jogou (times opostos): vitórias e derrotas dele contra cada adversário.
  headToHead(userId: number, seasonId?: number): Rival[] {
    return this.versus(userId, 'opposite', seasonId)
  },

  // Com quem o jogador já jogou junto (mesmo time): vitórias e derrotas dele com cada parceiro.
  withTeammates(userId: number, seasonId?: number): Rival[] {
    return this.versus(userId, 'same', seasonId)
  },

  versus(userId: number, relation: 'same' | 'opposite', seasonId?: number): Rival[] {
    const sideTest = relation === 'same' ? 'o.side = me.side AND o.user_id != me.user_id' : 'o.side != me.side'
    const rows = db
      .prepare(
        `SELECT o.user_id AS userId, u.game_name AS gameName, u.tag_line AS tagLine, u.profile_icon_id AS profileIconId,
                SUM(me.result = 'win') AS wins, SUM(me.result = 'loss') AS losses
         FROM match_players me
         JOIN matches m ON m.id = me.match_id
         JOIN match_players o ON o.match_id = me.match_id AND ${sideTest}
         JOIN users u ON u.id = o.user_id
         WHERE me.user_id = ? AND me.result != 'remake' AND ${SEASON_FILTER_SQL}
         GROUP BY o.user_id`,
      )
      .all(userId, seasonId ?? null, seasonId ?? null) as {
      userId: number
      gameName: string
      tagLine: string
      profileIconId: number | null
      wins: number
      losses: number
    }[]
    return rows.map((r) => ({
      userId: r.userId,
      riotId: formatRiotId(r.gameName, r.tagLine),
      iconId: resolveIconId(r.userId, r.profileIconId),
      wins: r.wins,
      losses: r.losses,
    }))
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
      .all(limit) as Omit<AdminMatch, 'players' | 'votes'>[]
    const votesOf = db.prepare(
      'SELECT kind, voter_id AS voterId, target_id AS targetId FROM match_votes WHERE match_id = ? ORDER BY kind, voter_id',
    )
    const playersOf = db.prepare(
      `SELECT mp.user_id AS userId, u.game_name AS gameName, u.tag_line AS tagLine, u.profile_icon_id AS profileIconId,
              mp.side, mp.is_captain AS isCaptain, mp.result
       FROM match_players mp LEFT JOIN users u ON u.id = mp.user_id
       WHERE mp.match_id = ?`,
    )
    return matches.map((m) => ({
      ...m,
      votes: votesOf.all(m.id) as MatchVote[],
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
      db.prepare('DELETE FROM match_votes WHERE match_id = ?').run(matchId)
      db.prepare('DELETE FROM match_players WHERE match_id = ?').run(matchId)
      return db.prepare('DELETE FROM matches WHERE id = ?').run(matchId).changes > 0
    })
    return remove()
  },
}
