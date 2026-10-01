import { useElapsed } from '../hooks/useElapsed'
import type { LobbySnapshot } from '../hooks/useLobby'
import { formatDuration, teamMembers } from '../lib/teams'
import TeamCard from './TeamCard'
import HexButton from './ui/HexButton'

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onVoteEnd: (value: boolean) => void
}

export default function LobbyPlaying({ lobby, skew, busy, onVoteEnd }: Props) {
  const { match } = lobby
  const elapsed = useElapsed(match.startedAt, skew)
  const progress = Math.min(100, (match.endVotes / match.votesNeeded) * 100)

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="flex items-center justify-center gap-2 font-display text-base text-hex-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-hex-300" />
          Partida em andamento
          {match.gameNumber > 1 && <span className="text-ash">· lados trocados</span>}
        </p>
        <p className="mt-1 font-cond text-6xl font-bold leading-none tabular-nums text-gold-50" aria-label="Tempo de partida">
          {formatDuration(elapsed)}
        </p>
      </div>

      <div className="grid items-start gap-3 md:grid-cols-[1fr_auto_1fr]">
        <TeamCard side="blue" members={teamMembers(lobby, 'blue')} />
        <span className="hidden self-center font-display text-3xl text-gold-500 md:block">vs</span>
        <TeamCard side="red" members={teamMembers(lobby, 'red')} />
      </div>

      {/* Botão e progresso lado a lado */}
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 sm:flex-row sm:gap-5">
        <HexButton
          variant={match.iVotedEnd ? 'secondary' : 'primary'}
          onClick={() => onVoteEnd(!match.iVotedEnd)}
          disabled={busy}
          className="shrink-0"
        >
          {match.iVotedEnd ? 'Desfazer meu voto' : 'Declarar fim da partida'}
        </HexButton>
        <div className="w-full flex-1">
          <div
            role="progressbar"
            aria-label="Votos para encerrar"
            aria-valuemin={0}
            aria-valuemax={match.votesNeeded}
            aria-valuenow={match.endVotes}
            className="h-1 w-full bg-rim"
          >
            <div className="h-full bg-gold-200 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-sm text-ash">
            <span className="font-cond text-base font-semibold text-gold-50">
              {match.endVotes}/{match.votesNeeded}
            </span>{' '}
            votos para encerrar a partida
          </p>
        </div>
      </div>
    </div>
  )
}
