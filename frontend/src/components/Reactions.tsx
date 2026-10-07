import type { LobbyPlayer } from '../hooks/useLobby'
import { reactionInfo, reactions, useLatestReaction, type ReactionId, type ShownReaction } from '../lib/reactions'
import { splitRiotId } from '../lib/teams'
import SummonerIcon from './ui/SummonerIcon'

// Botões de reação rápida (emoji + frase curta).
export function ReactionBar({ onReact }: { onReact: (id: ReactionId) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Reações rápidas">
      {reactions.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onReact(r.id)}
          title={r.label}
          className="flex items-center gap-1 rounded-full border border-rim bg-panel px-2.5 py-1 text-xs font-semibold text-gold-50 transition-colors hover:border-ash-dim hover:bg-rim active:scale-95"
        >
          <span className="text-sm leading-none">{r.emoji}</span>
          {r.label}
        </button>
      ))}
    </div>
  )
}

// Balão com a última reação do jogador, por cima do ícone dele (o pai precisa ser `relative`).
export function ReactionBubble({ userId }: { userId: number }) {
  const latest = useLatestReaction(userId)
  const info = latest ? reactionInfo(latest.reaction) : undefined
  if (!latest || !info) return null
  return (
    <span
      key={latest.id}
      className="reaction-pop pointer-events-none absolute -top-2 left-1 z-10 rounded-full border border-rim bg-abyss px-1.5 py-0.5 text-sm leading-none shadow-lg"
      title={info.label}
    >
      {info.emoji}
    </span>
  )
}

// Lista das reações recentes no canto da tela: quem mandou e o quê.
export function ReactionFeed({ items, players }: { items: ShownReaction[]; players: LobbyPlayer[] }) {
  if (items.length === 0) return null
  return (
    <ul className="pointer-events-none fixed bottom-24 left-4 z-40 flex flex-col gap-1.5 lg:bottom-6 lg:left-[17.5rem]" aria-live="polite">
      {items.slice(-4).map((item) => {
        const info = reactionInfo(item.reaction)
        const player = players.find((p) => p.id === item.userId)
        if (!info || !player) return null
        return (
          <li key={item.id} className="reaction-feed flex items-center gap-2 rounded-full border border-rim bg-abyss/95 py-1 pl-1 pr-3 text-sm">
            <SummonerIcon iconId={player.iconId} size="xs" ring={player.team === 'blue' ? 'blue' : player.team === 'red' ? 'red' : 'dim'} />
            <span className="font-semibold text-gold-50">{splitRiotId(player.riotId)[0]}</span>
            <span className="text-base leading-none">{info.emoji}</span>
            <span className="text-ash">{info.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
