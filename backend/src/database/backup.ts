import fs from 'node:fs'
import path from 'node:path'
import db, { dbPath } from './db'

// Backup automático do banco: uma cópia por dia, guardando só as mais recentes.
//   BACKUP_DIR      pasta das cópias (padrão: "backups" ao lado do banco)
//   BACKUP_KEEP     quantas cópias manter (padrão: 14)
//   BACKUP_ENABLED  "false" desliga
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(path.dirname(dbPath), 'backups')
const KEEP = Number(process.env.BACKUP_KEEP) || 14
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
const FIRST_RUN_DELAY_MS = 15_000
const FILE_PATTERN = /^data-\d{4}-\d{2}-\d{2}\.db$/

function prune() {
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => FILE_PATTERN.test(f)).sort()
  for (const old of files.slice(0, Math.max(0, files.length - KEEP))) fs.rmSync(path.join(BACKUP_DIR, old), { force: true })
}

// Faz a cópia de hoje, se ainda não existir. Usa o backup do próprio SQLite (seguro com o banco em uso).
export async function backupNow(): Promise<string | null> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const target = path.join(BACKUP_DIR, `data-${new Date().toISOString().slice(0, 10)}.db`)
  if (fs.existsSync(target)) return null

  const partial = `${target}.partial`
  await db.backup(partial)
  fs.renameSync(partial, target) // só aparece com o nome final quando a cópia está completa
  prune()
  return target
}

export function startBackups() {
  if (process.env.BACKUP_ENABLED === 'false') return
  const run = () =>
    backupNow()
      .then((file) => file && console.log(`Backup do banco salvo em ${file}`))
      .catch((err) => console.error('Falha no backup do banco:', err))
  setTimeout(run, FIRST_RUN_DELAY_MS).unref()
  setInterval(run, CHECK_EVERY_MS).unref()
}
