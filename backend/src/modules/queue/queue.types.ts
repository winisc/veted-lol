import type { QueueMode } from '../../shared/types/modes'

export type { QueueMode }

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
  mode: QueueMode
  players: QueuePlayer[]
  accepted: Set<number>
  endsAt: number
  durationMs: number
}

// Por que alguém ficou de fora de uma confirmação de partida.
export type DropReason = 'timeout' | 'declined' | 'removed'

// O que cada jogador recebe — sem expor ids de outros usuários.
export interface QueueSnapshot {
  status: QueueStatus
  mode: QueueMode | null // fila (ou confirmação) em que o jogador está
  size: number // jogadores esperando na fila do modo do jogador (0 se não está em fila)
  sizes: Record<QueueMode, number> // quantos esperam em cada fila (para os botões de entrar)
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
  // Só para quem aceitou e voltou para a fila: quem ficou de fora da confirmação e por quê.
  dropped?: { riotId: string; iconId: number; reason: DropReason }[]
}
