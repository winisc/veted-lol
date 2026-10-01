import type { IconRing } from '../components/ui/SummonerIcon'
import type { LobbyPlayer, LobbySnapshot, Side } from '../hooks/useLobby'

interface SideStyle {
  name: string
  border: string
  bg: string
  text: string
  bar: string // faixa sólida (cabeçalho do time, barras de progresso)
  ring: IconRing
}

export const sideStyle: Record<Side, SideStyle> = {
  blue: {
    name: 'Time Azul',
    border: 'border-team-blue/40',
    bg: 'bg-team-blue/[0.07]',
    text: 'text-team-blue',
    bar: 'bg-team-blue',
    ring: 'blue',
  },
  red: {
    name: 'Time Vermelho',
    border: 'border-team-red/40',
    bg: 'bg-team-red/[0.07]',
    text: 'text-team-red',
    bar: 'bg-team-red',
    ring: 'red',
  },
}

// Só o nome, sem a #TAG.
export const short = (p?: { riotId: string }) => p?.riotId.split('#')[0] ?? '?'

// Nome e tag separados ("Faker#KR1" -> ["Faker", "KR1"]).
export const splitRiotId = (riotId: string) => {
  const i = riotId.lastIndexOf('#')
  return i === -1 ? [riotId, ''] : [riotId.slice(0, i), riotId.slice(i + 1)]
}

// Capitão primeiro, depois os picks na ordem em que foram feitos.
export function teamMembers(lobby: LobbySnapshot, side: Side): LobbyPlayer[] {
  const byId = (id: number | null) => lobby.players.find((p) => p.id === id)
  const captain = byId(lobby.draft.sides[side])
  const picked = lobby.draft.picks.filter((pk) => byId(pk.byId)?.team === side).map((pk) => byId(pk.playerId))
  return [captain, ...picked].filter((p): p is LobbyPlayer => Boolean(p))
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
