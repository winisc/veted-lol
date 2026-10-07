import type { LobbyPlayer, LobbySnapshot } from '../hooks/useLobby'
import { splitRiotId } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import { CrownMedal, YouBadge } from './ui/Badges'
import PlayerLink from './ui/PlayerLink'
import SectionTitle from './ui/SectionTitle'
import SummonerIcon from './ui/SummonerIcon'

function voteLabel(votes: number | null) {
  return votes === 1 ? '1 voto' : `${votes ?? 0} votos`
}

function rankLabel(position: number | null) {
  return position === null ? 'Sem posição' : `#${position} na tabela`
}

// Quem tem posição na tabela vem primeiro (da melhor para a pior); quem não tem fica no fim.
const byTable = (a: LobbyPlayer, b: LobbyPlayer) =>
  (a.rankPosition ?? Number.POSITIVE_INFINITY) - (b.rankPosition ?? Number.POSITIVE_INFINITY)

// Capitães definidos, mostrados por alguns segundos antes do sorteio.
// Modo capitão: mostra os votos. Modo tabela: mostra a posição de cada um na tabela.
export default function LobbyCaptains({ lobby, skew }: { lobby: LobbySnapshot; skew: number }) {
  const ranked = lobby.mode === 'ranked'
  const captains = lobby.captains
    .map((id) => lobby.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const others = lobby.players
    .filter((p) => !p.isCaptain)
    .sort(ranked ? byTable : (a, b) => (b.votes ?? 0) - (a.votes ?? 0))
  const drawn = ranked && captains.some((c) => c.rankPosition === null)
  const detail = (p: LobbyPlayer) => (ranked ? rankLabel(p.rankPosition) : voteLabel(p.votes))

  return (
    <div className="space-y-5">
      <SectionTitle title={ranked ? 'Capitães pela tabela' : 'Capitães definidos'}>
        {ranked
          ? `Os 2 mais bem colocados na tabela entre os 10 lideram os times.${
              drawn ? ' Quem ainda não tem posição entrou por sorteio.' : ''
            } O sorteio decide quem escolhe primeiro.`
          : 'O sorteio decide quem escolhe primeiro.'}
      </SectionTitle>

      <div className="flex items-center justify-center gap-6 sm:gap-14">
        {captains.map((captain, i) => {
          const [name, tag] = splitRiotId(captain.riotId)
          return (
            <div key={captain.id} className="contents">
              {i === 1 && <span className="font-display text-3xl text-gold-500">vs</span>}
              <div className="flex min-w-0 items-center gap-4">
                <SummonerIcon iconId={captain.iconId} size="lg" ring="gold" badge={<CrownMedal />} />
                <div className="min-w-0">
                  <p className="truncate font-display text-2xl leading-tight text-gold-50">
                    <PlayerLink userId={captain.id} newTab>
                      {name}
                    </PlayerLink>
                  </p>
                  <p className="text-sm text-ash">#{tag}</p>
                  <p className="flex items-center gap-2 font-cond text-base font-semibold text-gold-200">
                    {detail(captain)}
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
        <h3 className="mb-2 font-display text-base text-gold-50">
          {ranked ? 'Posição dos demais na tabela' : 'Votos dos demais'}
        </h3>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {others.map((player) => (
            <li
              key={player.id}
              className={`flex items-center gap-2 rounded-md border px-2 py-1 ${
                player.isYou ? 'border-gold-200/40 bg-gold-200/6' : 'border-transparent bg-panel'
              }`}
            >
              <SummonerIcon iconId={player.iconId} size="xs" ring="dim" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gold-50">
                <PlayerLink userId={player.id} newTab>
                  {splitRiotId(player.riotId)[0]}
                </PlayerLink>
              </span>
              <span className="font-cond text-sm font-semibold tabular-nums text-ash">{detail(player)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
