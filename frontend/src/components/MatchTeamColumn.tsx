import type { LobbyPlayer, LobbySnapshot, Side } from '../hooks/useLobby'
import { sideStyle, splitRiotId, teamMembers } from '../lib/teams'
import { CrownIcon } from './ui/icons'
import EloBadge from './ui/EloBadge'
import PlayerLink from './ui/PlayerLink'
import RankBadge from './ui/RankBadge'
import SummonerIcon from './ui/SummonerIcon'

// Coluna de um time na partida: cada jogador com o ícone de invocador, posição na tabela e elo.
export default function MatchTeamColumn({ lobby, side, winner = false }: { lobby: LobbySnapshot; side: Side; winner?: boolean }) {
  const style = sideStyle[side]
  const members = teamMembers(lobby, side)

  return (
    <div className={`overflow-hidden rounded-xl border bg-abyss ${winner ? 'border-gold-200/60' : 'border-rim'}`}>
      <header className="flex items-center justify-between gap-2 border-b border-rim px-3 py-2.5">
        <p className={`flex items-center gap-2 whitespace-nowrap font-display text-base ${style.text}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${style.bar}`} aria-hidden="true" />
          {style.name}
          {winner && <span className="rounded bg-gold-200 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-void">Vitória</span>}
        </p>
      </header>

      <ul className="space-y-1 p-1.5">
        {members.map((m) => (
          <PlayerLine key={m.id} lobby={lobby} player={m} />
        ))}
      </ul>
    </div>
  )
}

function PlayerLine({ lobby, player }: { lobby: LobbySnapshot; player: LobbyPlayer }) {
  const captain = lobby.captains.includes(player.id)
  return (
    <li className={`flex items-center gap-2.5 rounded-lg py-1.5 pl-2 pr-2.5 ${player.isYou ? 'bg-gold-200/[0.06] ring-1 ring-gold-200/30' : 'bg-panel'}`}>
      <SummonerIcon iconId={player.iconId} size="sm" ring="dim" />

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate text-sm font-semibold ${player.isYou ? 'text-gold-200' : 'text-gold-50'}`}>
            <PlayerLink userId={player.id} newTab>
              {splitRiotId(player.riotId)[0]}
            </PlayerLink>
          </span>
          {captain && <CrownIcon className="h-3.5 w-3.5 shrink-0 text-gold-200" />}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <RankBadge position={player.rankPosition} />
        <EloBadge elo={player.elo} compact />
      </span>
    </li>
  )
}
