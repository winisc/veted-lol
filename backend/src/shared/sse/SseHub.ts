import type { Response } from 'express'

const HEARTBEAT_MS = 25_000

// Conexões SSE abertas, agrupadas por usuário (o mesmo jogador pode ter várias abas).
export class SseHub {
  private connections = new Map<number, Set<Response>>()

  constructor() {
    setInterval(() => {
      for (const set of this.connections.values()) {
        for (const res of set) res.write(': ping\n\n')
      }
    }, HEARTBEAT_MS).unref()
  }

  add(userId: number, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()

    const set = this.connections.get(userId) ?? new Set()
    set.add(res)
    this.connections.set(userId, set)
  }

  remove(userId: number, res: Response) {
    const set = this.connections.get(userId)
    if (!set) return
    set.delete(res)
    if (set.size === 0) this.connections.delete(userId)
  }

  hasConnection(userId: number) {
    return this.connections.has(userId)
  }

  userIds() {
    return [...this.connections.keys()]
  }

  send(userId: number, payload: unknown) {
    const data = `data: ${JSON.stringify(payload)}\n\n`
    for (const res of this.connections.get(userId) ?? []) res.write(data)
  }
}
