import type { LobbyPlayer, LobbySnapshot, Side } from '../hooks/useLobby'
import { useChampions } from '../lib/champions'
import { sideStyle, splitRiotId, teamMembers } from '../lib/teams'
import { CrownIcon } from './ui/icons'
import EloBadge from './ui/EloBadge'
import PlayerLink from './ui/PlayerLink'
import RankBadge from './ui/RankBadge'
import SummonerIcon from './ui/SummonerIcon'

// Coluna de um time na partida, no mesmo estilo da seleção de campeões: bans do time no cabeçalho e cada jogador
// com o campeão em destaque (sem seleção de campeões, como no ARAM, o ícone de invocador).
export default function MatchTeamColumn({ lobby, side, winner = false }: { lobby: LobbySnapshot; side: Side; winner?: boolean }) {
  const style = sideStyle[side]
  const { nameOf, iconOf } = useChampions()
  const members = teamMembers(lobby, side)
  const select = lobby.champSelect
  const bans = select?.bans.find((b) => members.some((m) => m.id === b.userId))?.champions ?? []

  return (
    <div className={`overflow-hidden rounded-xl border bg-abyss ${winner ? 'border-gold-200/60' : 'border-rim'}`}>
      <header className="flex items-center justify-between gap-2 border-b border-rim px-3 py-2.5">
        <p className={`flex items-center gap-2 whitespace-nowrap font-display text-base ${style.text}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${style.bar}`} aria-hidden="true" />
          {style.name}
          {winner && <span className="rounded bg-gold-200 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-void">Vitória</span>}
        </p>
        {select && (
          <span className="flex items-center gap-1" aria-label="Bans do time">
            {Array.from({ length: select.banCount }, (_, i) => bans[i] ?? null).map((ban, i) => (
              <span
                key={i}
                title={ban ? `Ban: ${nameOf(ban)}` : 'Sem ban'}
                className={`relative grid h-6 w-6 place-items-center overflow-hidden rounded border ${ban ? 'border-team-red/60' : 'border-rim bg-void/60'}`}
              >
                {ban && (
                  <>
                    <img src={iconOf(ban)} alt="" className="h-full w-full scale-110 object-cover grayscale" />
                    <span aria-hidden="true" className="absolute h-[2px] w-[140%] rotate-45 bg-team-red" />
                  </>
                )}
              </span>
            ))}
          </span>
        )}
      </header>

      <ul className="space-y-1 p-1.5">
        {members.map((m) => (
          <PlayerLine key={m.id} lobby={lobby} player={m} champion={m.champion} nameOf={nameOf} iconOf={iconOf} />
        ))}
      </ul>
    </div>
  )
}

function PlayerLine({
  lobby,
  player,
  champion,
  nameOf,
  iconOf,
}: {
  lobby: LobbySnapshot
  player: LobbyPlayer
  champion?: string
  nameOf: (id: string) => string
  iconOf: (id: string) => string
}) {
  const captain = lobby.captains.includes(player.id)
  return (
    <li className={`flex items-center gap-2.5 rounded-lg py-1.5 pl-2 pr-2.5 ${player.isYou ? 'bg-gold-200/[0.06] ring-1 ring-gold-200/30' : 'bg-panel'}`}>
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md ring-1 ring-gold-200/40">
        {champion ? (
          <img src={iconOf(champion)} alt={nameOf(champion)} className="h-full w-full scale-110 object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-void/70">
            <SummonerIcon iconId={player.iconId} size="sm" ring="dim" />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate text-sm font-semibold ${player.isYou ? 'text-gold-200' : 'text-gold-50'}`}>
            <PlayerLink userId={player.id} newTab>
              {splitRiotId(player.riotId)[0]}
            </PlayerLink>
          </span>
          {captain && <CrownIcon className="h-3.5 w-3.5 shrink-0 text-gold-200" />}
        </span>
        <span className="block truncate text-xs text-ash">{champion ? nameOf(champion) : ' '}</span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <RankBadge position={player.rankPosition} />
        <EloBadge elo={player.elo} compact />
      </span>
    </li>
  )
}
