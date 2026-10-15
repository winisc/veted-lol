import db from '../../database/db'
import { AppError } from '../../shared/errors/AppError'
import { formatRiotId, parseRiotId, type RiotId } from '../../shared/utils/riotId'
import { userRepository } from '../users/user.repository'

// Banimento por Riot ID. Vale mesmo para quem ainda não tem conta (não consegue se cadastrar).
// Quem é banido não loga, perde a sessão aberta e aparece como "Banido" na tabela.

export interface Ban {
  riotId: string
  reason: string | null
  bannedAt: string
  bannedBy: string | null // Riot ID do admin que baniu
  userId: number | null // conta que tem esse Riot ID (null = ainda não cadastrado)
}

interface BanRow {
  game_name: string
  tag_line: string
  reason: string | null
  banned_at: string
  banned_by: number | null
}

export const bannedError = () => new AppError('Esta conta foi banida.', 403, 'BANNED')

// Contas banidas, em memória: o middleware de autenticação confere isso a cada requisição.
let bannedIds: Set<number> | null = null

function loadBannedIds() {
  const rows = db
    .prepare(
      `SELECT u.id FROM users u
       JOIN bans b ON b.game_name = u.game_name COLLATE NOCASE AND b.tag_line = u.tag_line COLLATE NOCASE`,
    )
    .all() as { id: number }[]
  bannedIds = new Set(rows.map((r) => r.id))
  return bannedIds
}

export const banService = {
  bannedUserIds(): Set<number> {
    return bannedIds ?? loadBannedIds()
  },

  isUserBanned(userId: number) {
    return this.bannedUserIds().has(userId)
  },

  isRiotIdBanned({ gameName, tagLine }: RiotId) {
    return Boolean(
      db
        .prepare('SELECT 1 FROM bans WHERE game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE')
        .get(gameName, tagLine),
    )
  },

  list(): Ban[] {
    const rows = db.prepare('SELECT * FROM bans ORDER BY banned_at DESC').all() as BanRow[]
    return rows.map((row) => {
      const by = row.banned_by !== null ? userRepository.findById(row.banned_by) : null
      return {
        riotId: formatRiotId(row.game_name, row.tag_line),
        reason: row.reason,
        bannedAt: row.banned_at,
        bannedBy: by ? formatRiotId(by.gameName, by.tagLine) : null,
        userId: userRepository.findByRiotId({ gameName: row.game_name, tagLine: row.tag_line })?.id ?? null,
      }
    })
  },

  // Bane um Riot ID. Devolve a conta afetada (se existir), para quem chamou tirar ela da fila.
  ban(actorId: number, riotIdInput: unknown, reasonInput: unknown): { userId: number | null } {
    const parsed = parseRiotId(riotIdInput)
    if (!parsed) throw new AppError('Riot ID inválido. Use o formato Nome#TAG.', 400)
    const user = userRepository.findByRiotId(parsed)
    if (user?.id === actorId) throw new AppError('Você não pode banir a si mesmo.', 400)
    if (this.isRiotIdBanned(parsed)) throw new AppError('Esse Riot ID já está banido.', 409)

    const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 200) : null
    // Com conta: guarda a grafia da conta (a mesma da tabela).
    const name = user ? { gameName: user.gameName, tagLine: user.tagLine } : parsed
    db.prepare('INSERT INTO bans (game_name, tag_line, reason, banned_at, banned_by) VALUES (?, ?, ?, ?, ?)').run(
      name.gameName,
      name.tagLine,
      reason,
      new Date().toISOString(),
      actorId,
    )
    loadBannedIds()
    return { userId: user?.id ?? null }
  },

  unban(riotIdInput: unknown) {
    const parsed = parseRiotId(riotIdInput)
    if (!parsed) throw new AppError('Riot ID inválido.', 400)
    const result = db
      .prepare('DELETE FROM bans WHERE game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE')
      .run(parsed.gameName, parsed.tagLine)
    if (result.changes === 0) throw new AppError('Esse Riot ID não está banido.', 404)
    loadBannedIds()
  },
}
