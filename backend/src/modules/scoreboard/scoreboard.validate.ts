import { AppError } from '../../shared/errors/AppError'
import type { PlayerGameStats } from './scoreboard.types'

const CHAMPION_ID = /^[A-Za-z0-9]{2,30}$/

function int(value: unknown, field: string, max: number, required: boolean): number | null {
  if (value === null || value === undefined || value === '') {
    if (required) throw new AppError(`Preencha ${field} de todos os jogadores.`, 400)
    return null
  }
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > max) throw new AppError(`Valor inválido em ${field}.`, 400)
  return n
}

// Confere os dados enviados pelo capitão: uma linha para cada jogador da partida, com campeão e KDA
// obrigatórios (CS, ouro e dano podem ficar em branco).
export function validateStats(body: unknown, playerIds: number[]): PlayerGameStats[] {
  const rows = (body as { rows?: unknown })?.rows
  if (!Array.isArray(rows)) throw new AppError('Dados da partida inválidos.', 400)

  const result = playerIds.map((userId) => {
    const row = rows.find((r) => (r as { userId?: unknown })?.userId === userId) as Record<string, unknown> | undefined
    if (!row) throw new AppError('Faltam jogadores nos dados da partida.', 400)
    if (typeof row.champion !== 'string' || !CHAMPION_ID.test(row.champion)) {
      throw new AppError('Escolha o campeão de todos os jogadores.', 400)
    }
    return {
      userId,
      champion: row.champion,
      kills: int(row.kills, 'os abates', 99, true)!,
      deaths: int(row.deaths, 'as mortes', 99, true)!,
      assists: int(row.assists, 'as assistências', 99, true)!,
      cs: int(row.cs, 'o farm', 2000, false),
      gold: int(row.gold, 'o ouro', 200_000, false),
      damage: int(row.damage, 'o dano', 1_000_000, false),
    }
  })
  if (new Set(result.map((r) => r.champion)).size !== result.length) {
    throw new AppError('Tem campeão repetido: cada jogador joga com um campeão diferente.', 400)
  }
  return result
}
