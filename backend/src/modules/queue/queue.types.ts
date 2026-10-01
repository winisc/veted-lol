// idle -> queued -> ready_check (fila fechou: aceitar/recusar) -> matched (todos aceitaram: está em um lobby)
export type QueueStatus = 'idle' | 'queued' | 'ready_check' | 'matched'

export interface QueuePlayer {
  userId: number
  riotId: string
  iconId: number
}

// Confirmação de partida: os jogadores da fila que fechou precisam aceitar dentro do prazo.
export interface ReadyCheck {
  id: string
  players: QueuePlayer[]
  accepted: Set<number>
  endsAt: number
  durationMs: number
}

// O que cada jogador recebe — sem expor ids de outros usuários.
export interface QueueSnapshot {
  status: QueueStatus
  size: number
  required: number
  players: { riotId: string; iconId: number; isYou: boolean }[]
  readyCheck: {
    endsAt: number
    durationMs: number
    now: number // hora do servidor, para a contagem regressiva bater no cliente
    accepted: number
    total: number
    iAccepted: boolean
  } | null
  notice?: string // aviso pontual (ex.: "você não aceitou a partida e saiu da fila")
}
