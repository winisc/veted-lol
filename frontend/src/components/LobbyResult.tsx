import { useElapsed } from '../hooks/useElapsed'
import type { LobbySnapshot, MatchOutcome, Side } from '../hooks/useLobby'
import { formatDuration, short, sideStyle, teamMembers } from '../lib/teams'
import SectionTitle from './ui/SectionTitle'
import SummonerIcon from './ui/SummonerIcon'

interface Props {
  lobby: LobbySnapshot
  busy: boolean
  skew: number
  onVote: (choice: MatchOutcome) => void
}

export default function LobbyResult({ lobby, busy, skew, onVote }: Props) {
  const { match } = lobby
  const duration = useElapsed(match.startedAt, skew, match.endedAt)

  const teamOption = (side: Side) => {
    const members = teamMembers(lobby, side)
    return {
      choice: side as MatchOutcome,
      title: sideStyle[side].name,
      subtitle: `Capitão: ${short(members[0])}`,
      frame: `${sideStyle[side].border} ${sideStyle[side].bg}`,
      text: sideStyle[side].text,
      bar: sideStyle[side].bar,
      icons: members,
      ring: sideStyle[side].ring,
    }
  }

  const options = [
    teamOption('blue'),
    teamOption('red'),
    {
      choice: 'remake' as MatchOutcome,
      title: 'Remake',
      subtitle: 'Anula a partida. Não conta no histórico.',
      frame: 'border-ash-dim bg-rim/30',
      text: 'text-gold-50',
      bar: 'bg-ash',
      icons: [],
      ring: 'dim' as const,
    },
  ]

  return (
    <div className="space-y-4">
      <SectionTitle title="Quem venceu?">
        Duração <span className="font-cond text-lg font-semibold tabular-nums text-gold-50">{formatDuration(duration)}</span>.
        A primeira opção a chegar em {match.votesNeeded} votos decide. Dá para mudar o voto até lá.
      </SectionTitle>

      <ul className="grid gap-4 md:grid-cols-3">
        {options.map((opt) => {
          const count = match.resultCounts[opt.choice]
          const selected = match.myResultVote === opt.choice
          return (
            <li key={opt.choice}>
              <button
                type="button"
                onClick={() => onVote(opt.choice)}
                disabled={busy}
                aria-pressed={selected}
                className={`flex h-full w-full flex-col gap-3 border-2 p-4 text-left transition disabled:cursor-wait ${
                  selected ? `${opt.frame}` : 'border-rim bg-abyss/80 hover:border-gold-500'
                }`}
              >
                <div>
                  <p className={`font-display text-2xl ${opt.text}`}>{opt.title}</p>
                  <p className="text-sm text-ash">{opt.subtitle}</p>
                </div>

                {opt.icons.length > 0 && (
                  <div className="flex -space-x-2">
                    {opt.icons.map((p) => (
                      <SummonerIcon key={p.id} iconId={p.iconId} size="sm" ring={opt.ring} />
                    ))}
                  </div>
                )}

                <div className="mt-auto">
                  <div className="h-1 w-full bg-rim">
                    <div
                      className={`h-full transition-all duration-500 ${opt.bar}`}
                      style={{ width: `${Math.min(100, (count / match.votesNeeded) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-ash">
                      <span className="font-cond text-lg font-semibold tabular-nums text-gold-50">
                        {count}/{match.votesNeeded}
                      </span>{' '}
                      votos
                    </span>
                    {selected && <span className="font-semibold text-gold-200">Seu voto</span>}
                  </p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
