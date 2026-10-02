import Database from 'better-sqlite3'
import path from 'node:path'

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data.db')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_name TEXT NOT NULL,
    tag_line TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (game_name COLLATE NOCASE, tag_line COLLATE NOCASE)
  );

  -- Histórico: uma linha por partida e uma por jogador. V/D/MVP/bagre e ranking saem daqui.
  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    outcome TEXT NOT NULL,          -- 'blue' | 'red' | 'remake'
    mvp_user_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS match_players (
    match_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    side TEXT NOT NULL,             -- 'blue' | 'red'
    is_captain INTEGER NOT NULL,
    result TEXT NOT NULL,           -- 'win' | 'loss' | 'remake'
    is_mvp INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (match_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players (user_id);
`)

// Migrações simples para bancos criados antes de uma coluna existir.
const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
if (!userColumns.some((c) => c.name === 'profile_icon_id')) {
  // Ícone de invocador vindo da Riot. Sem ele, o app usa um ícone padrão (ver shared/utils/icons.ts).
  db.exec('ALTER TABLE users ADD COLUMN profile_icon_id INTEGER')
}
const matchColumns = db.prepare('PRAGMA table_info(matches)').all() as { name: string }[]
if (!matchColumns.some((c) => c.name === 'mode')) {
  // Modo da fila que gerou a partida: 'vote' (capitães por votação) ou 'ranked' (pela tabela).
  db.exec("ALTER TABLE matches ADD COLUMN mode TEXT NOT NULL DEFAULT 'vote'")
}
if (!userColumns.some((c) => c.name === 'is_admin')) {
  // Acesso à tela de admin. Também dá para liberar pelo .env (ADMIN_RIOT_IDS).
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0')
}
if (!matchColumns.some((c) => c.name === 'bagre_user_id')) {
  // Bagre: o pior jogador da partida, votado entre os perdedores (perde pontos na tabela).
  db.exec('ALTER TABLE matches ADD COLUMN bagre_user_id INTEGER')
}
const playerColumns = db.prepare('PRAGMA table_info(match_players)').all() as { name: string }[]
if (!playerColumns.some((c) => c.name === 'is_bagre')) {
  db.exec('ALTER TABLE match_players ADD COLUMN is_bagre INTEGER NOT NULL DEFAULT 0')
}

export default db
