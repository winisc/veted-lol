import db from '../../database/db'
import { resolveIconId } from '../../shared/utils/icons'
import type { RiotId } from '../../shared/utils/riotId'
import type { User } from './user.types'

interface UserRow {
  id: number
  game_name: string
  tag_line: string
  password_hash: string
  profile_icon_id: number | null
  is_admin: number
  created_at: string // 'YYYY-MM-DD HH:MM:SS' em UTC
}

// Admins definidos no .env (ex.: ADMIN_RIOT_IDS="Wini#deus,Outro#BR1"), sem diferenciar maiúsculas.
// Servem para liberar o primeiro admin; os demais podem ser promovidos pela tela de admin.
function envAdmins(): Set<string> {
  return new Set(
    (process.env.ADMIN_RIOT_IDS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

function toUser(row: UserRow): User {
  const riotId = `${row.game_name}#${row.tag_line}`.toLowerCase()
  return {
    id: row.id,
    gameName: row.game_name,
    tagLine: row.tag_line,
    passwordHash: row.password_hash,
    iconId: resolveIconId(row.id, row.profile_icon_id),
    isAdmin: row.is_admin === 1 || envAdmins().has(riotId),
    createdAt: `${row.created_at.replace(' ', 'T')}Z`,
  }
}

function findById(id: number): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  return row ? toUser(row) : null
}

export const userRepository = {
  findById,

  findByRiotId({ gameName, tagLine }: RiotId): User | null {
    const row = db
      .prepare('SELECT * FROM users WHERE game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE')
      .get(gameName, tagLine) as UserRow | undefined
    return row ? toUser(row) : null
  },

  listAll(): User[] {
    return (db.prepare('SELECT * FROM users ORDER BY game_name COLLATE NOCASE').all() as UserRow[]).map(toUser)
  },

  create({ gameName, tagLine }: RiotId, passwordHash: string, profileIconId: number | null = null): User {
    const result = db
      .prepare('INSERT INTO users (game_name, tag_line, password_hash, profile_icon_id) VALUES (?, ?, ?, ?)')
      .run(gameName, tagLine, passwordHash, profileIconId)
    return findById(Number(result.lastInsertRowid))!
  },

  updateIcon(userId: number, profileIconId: number) {
    db.prepare('UPDATE users SET profile_icon_id = ? WHERE id = ?').run(profileIconId, userId)
  },

  setAdmin(userId: number, isAdmin: boolean) {
    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, userId)
  },

  // Admin pelo .env não pode ser removido pela tela (só tirando do .env).
  isEnvAdmin(user: User) {
    return envAdmins().has(`${user.gameName}#${user.tagLine}`.toLowerCase())
  },

  setPassword(userId: number, passwordHash: string) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId)
  },
}
