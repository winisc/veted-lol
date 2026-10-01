import type { LobbySnapshot } from '../hooks/useLobby'
import { splitRiotId } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import { CrownMedal, YouBadge } from './ui/Badges'
import SectionTitle from './ui/SectionTitle'
import SummonerIcon from './ui/SummonerIcon'

function voteLabel(votes: number | null) {
  return votes === 1 ? '1 voto' : `${votes ?? 0} votos`
}

// Resultado da votação, mostrado por alguns segundos antes do sorteio.
export default function LobbyCaptains({ lobby, skew }: { lobby: LobbySnapshot; skew: number }) {
  const captains = lobby.captains
    .map((id) => lobby.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const others = lobby.players.filter((p) => !p.isCaptain).sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))

  return (
    <div className="space-y-5">
      <SectionTitle title="Capitães definidos">O sorteio decide quem escolhe primeiro.</SectionTitle>

      <div className="flex items-center justify-center gap-6 sm:gap-14">
        {captains.map((captain, i) => {
          const [name, tag] = splitRiotId(captain.riotId)
          return (
            <div key={captain.id} className="contents">
              {i === 1 && <span className="font-display text-3xl text-gold-500">vs</span>}
              <div className="flex min-w-0 items-center gap-4">
                <SummonerIcon iconId={captain.iconId} size="lg" ring="gold" glow badge={<CrownMedal />} />
                <div className="min-w-0">
                  <p className="truncate font-display text-2xl leading-tight text-gold-50">{name}</p>
                  <p className="text-sm text-ash">#{tag}</p>
                  <p className="flex items-center gap-2 font-cond text-base font-semibold text-gold-200">
                    {voteLabel(captain.votes)}
                    {captain.isYou && <YouBadge />}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <PhaseTimer endsAt={lobby.endsAt} durationMs={lobby.durationMs} skew={skew} label="Sorteio em instantes" />

      <div>
        <h3 className="mb-2 font-display text-base text-gold-50">Votos dos demais</h3>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {others.map((player) => (
            <li
              key={player.id}
              className={`flex items-center gap-2 border px-2 py-1 ${
                player.isYou ? 'border-hex-300/50 bg-hex-900/40' : 'border-rim/80 bg-void/50'
              }`}
            >
              <SummonerIcon iconId={player.iconId} size="xs" ring="dim" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gold-50">{splitRiotId(player.riotId)[0]}</span>
              <span className="font-cond text-sm font-semibold tabular-nums text-ash">{voteLabel(player.votes)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
