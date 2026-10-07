import { createContext, useContext } from 'react'

// Reações rápidas do lobby. Os ids têm que bater com a lista do servidor (lobby.service).
export const reactions = [
  { id: 'gg', emoji: '🤝', label: 'GG' },
  { id: 'bora', emoji: '💪', label: 'Bora!' },
  { id: 'fire', emoji: '🔥', label: 'On fire' },
  { id: 'laugh', emoji: '😂', label: 'KKKK' },
  { id: 'rage', emoji: '😡', label: 'Pqp' },
  { id: 'bagre', emoji: '🐟', label: 'Bagre!' },
  { id: 'carry', emoji: '⭐', label: 'Carregou' },
  { id: 'f', emoji: '💀', label: 'F' },
] as const

export type ReactionId = (typeof reactions)[number]['id']

export const reactionInfo = (id: string) => reactions.find((r) => r.id === id)

export interface ShownReaction {
  id: string
  userId: number
  reaction: string
}

// Reações na tela agora (do lobby), para mostrar por cima do ícone de quem mandou.
export const ReactionsContext = createContext<ShownReaction[]>([])

export function useLatestReaction(userId: number): ShownReaction | undefined {
  const list = useContext(ReactionsContext)
  for (let i = list.length - 1; i >= 0; i--) if (list[i].userId === userId) return list[i]
  return undefined
}
