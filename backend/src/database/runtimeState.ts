import db from './db'

// Guarda no SQLite o estado "ao vivo" (fila, confirmações e lobbies), que antes só existia em memória,
// para sobreviver a um reinício do servidor. Cada módulo registra uma função que devolve o seu estado e
// avisa quando ele mudou; a gravação é adiada um instante (debounce) para juntar várias mudanças seguidas.

db.exec(`
  CREATE TABLE IF NOT EXISTS runtime_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

const PERSIST_DELAY_MS = 250

const collectors = new Map<string, () => unknown>()
const timers = new Map<string, NodeJS.Timeout>()

// JSON não guarda Map nem Set: eles viram objetos marcados e voltam ao carregar.
function replacer(_key: string, value: unknown) {
  if (value instanceof Map) return { __type: 'Map', entries: [...value] }
  if (value instanceof Set) return { __type: 'Set', values: [...value] }
  return value
}

function reviver(_key: string, value: unknown) {
  const tagged = value as { __type?: string; entries?: [unknown, unknown][]; values?: unknown[] } | null
  if (tagged && typeof tagged === 'object') {
    if (tagged.__type === 'Map') return new Map(tagged.entries)
    if (tagged.__type === 'Set') return new Set(tagged.values)
  }
  return value
}

function write(key: string) {
  const collect = collectors.get(key)
  if (!collect) return
  try {
    db.prepare(
      `INSERT INTO runtime_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).run(key, JSON.stringify(collect(), replacer))
  } catch (err) {
    console.error(`Falha ao salvar o estado "${key}":`, err)
  }
}

// Registra de onde vem o estado de `key`.
export function registerPersistence(key: string, collect: () => unknown) {
  collectors.set(key, collect)
}

// Avisa que o estado mudou: grava daqui a pouco (várias chamadas seguidas viram uma gravação só).
export function schedulePersist(key: string) {
  if (timers.has(key)) return
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      write(key)
    }, PERSIST_DELAY_MS),
  )
}

// Grava tudo agora (usado ao desligar o servidor).
export function flushAll() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  for (const key of collectors.keys()) write(key)
}

export function loadState<T>(key: string): T | null {
  try {
    const row = db.prepare('SELECT value FROM runtime_state WHERE key = ?').get(key) as { value: string } | undefined
    return row ? (JSON.parse(row.value, reviver) as T) : null
  } catch (err) {
    console.error(`Falha ao ler o estado "${key}":`, err)
    return null
  }
}
