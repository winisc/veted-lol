import type { LobbyPlayer, LobbySnapshot } from '../hooks/useLobby'
import { splitRiotId } from '../lib/teams'
import { CrownIcon } from './ui/icons'
import PlayerLink from './ui/PlayerLink'
import SummonerIcon from './ui/SummonerIcon'

export function rankLabel(position: number | null) {
  return position === null ? 'Sem posição' : `#${position} na tabela`
}

// Lista simples de jogadores (ícone, nick e um detalhe à direita), 4 por linha.
// `players`: só esses (na ordem dada); sem isso, os capitães aparecem separados em cima e os demais (8, duas linhas) embaixo.
// `detail`: padrão é a posição na tabela.
export default function LobbyPlayers({
  lobby,
  players: only,
  detail = (p) => rankLabel(p.rankPosition),
}: {
  lobby: LobbySnapshot
  players?: LobbyPlayer[]
  detail?: (player: LobbyPlayer) => string
}) {
  if (!only) {
    const captains = lobby.captains
      .map((id) => lobby.players.find((p) => p.id === id))
      .filter((p): p is LobbyPlayer => Boolean(p))
    const others = lobby.players.filter((p) => !lobby.captains.includes(p.id))
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {captains.map((captain, i) => (
            <div key={captain.id} className="contents">
              {i === 1 && <span className="font-display text-lg text-gold-500">vs</span>}
              <div
                className={`flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 ${
                  captain.isYou ? 'border-gold-200/40 bg-gold-200/6' : 'border-gold-200/20 bg-panel'
                }`}
              >
                <SummonerIcon iconId={captain.iconId} size="xs" ring="gold" />
                <span className="min-w-0 truncate text-sm font-semibold text-gold-50">
                  <PlayerLink userId={captain.id} newTab>
                    {splitRiotId(captain.riotId)[0]}
                  </PlayerLink>
                </span>
                <CrownIcon className="h-3.5 w-3.5 shrink-0 text-gold-200" />
                <span className="font-cond text-sm font-semibold tabular-nums text-ash">{detail(captain)}</span>
              </div>
            </div>
          ))}
        </div>
        <LobbyPlayers lobby={lobby} players={others} detail={detail} />
      </div>
    )
  }
  const players = only

  return (
    <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {players.map((player) => (
        <li
          key={player.id}
          className={`flex items-center gap-2 rounded-md border px-2 py-1 ${
            player.isYou ? 'border-gold-200/40 bg-gold-200/6' : 'border-transparent bg-panel'
          }`}
        >
          <SummonerIcon iconId={player.iconId} size="xs" ring={lobby.captains.includes(player.id) ? 'gold' : 'dim'} />
          <span className="flex min-w-0 flex-1 items-center gap-1 text-sm font-semibold text-gold-50">
            <span className="min-w-0 truncate">
              <PlayerLink userId={player.id} newTab>
                {splitRiotId(player.riotId)[0]}
              </PlayerLink>
            </span>
            {lobby.captains.includes(player.id) && <CrownIcon className="h-3.5 w-3.5 shrink-0 text-gold-200" />}
          </span>
          <span className="font-cond text-sm font-semibold tabular-nums text-ash">{detail(player)}</span>
        </li>
      ))}
    </ul>
  )
}
