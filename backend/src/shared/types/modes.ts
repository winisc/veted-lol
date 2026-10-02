// Modos de fila:
//   vote   -> capitães escolhidos por votação dos 10 jogadores
//   ranked -> capitães são os 2 mais bem colocados na tabela entre os 10
export type QueueMode = 'vote' | 'ranked'

export const QUEUE_MODES: QueueMode[] = ['vote', 'ranked']

export function isQueueMode(value: unknown): value is QueueMode {
  return value === 'vote' || value === 'ranked'
}
