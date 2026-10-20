// Modos de fila:
//   vote   -> capitães escolhidos por votação dos 10 jogadores
//   ranked -> capitães são os 2 mais bem colocados na tabela entre os 10
//   aram3 / aram4 / aram5 -> ARAM 3x3, 4x4 e 5x5: sem capitães nem draft, os times são sorteados equilibrando
//                            pela tabela de ARAM (uma tabela só para os três tamanhos)
export type QueueMode = 'vote' | 'ranked' | 'aram3' | 'aram4' | 'aram5'

export const QUEUE_MODES: QueueMode[] = ['vote', 'ranked', 'aram3', 'aram4', 'aram5']

export function isQueueMode(value: unknown): value is QueueMode {
  return typeof value === 'string' && (QUEUE_MODES as string[]).includes(value)
}

export const isAramMode = (mode: QueueMode) => mode === 'aram3' || mode === 'aram4' || mode === 'aram5'

// Tabelas: a normal (filas 5x5 com draft) e a de ARAM. Cada partida conta em uma só.
export type Board = 'normal' | 'aram'

export const boardOf = (mode: QueueMode): Board => (isAramMode(mode) ? 'aram' : 'normal')

export function isBoard(value: unknown): value is Board {
  return value === 'normal' || value === 'aram'
}

// Filtro SQL das partidas de uma tabela (`m` = tabela matches).
export const boardSql = (board: Board) => (board === 'aram' ? "m.mode LIKE 'aram%'" : "m.mode NOT LIKE 'aram%'")

// Jogadores para fechar a fila de cada modo. QUEUE_SIZE permite testar a fila normal com poucos jogadores (padrão 10).
const NORMAL_SIZE = Number(process.env.QUEUE_SIZE) || 10
const ARAM_SIZES: Record<'aram3' | 'aram4' | 'aram5', number> = { aram3: 6, aram4: 8, aram5: 10 }

export function queueSize(mode: QueueMode): number {
  return isAramMode(mode) ? ARAM_SIZES[mode as keyof typeof ARAM_SIZES] : NORMAL_SIZE
}
