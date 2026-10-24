import { useElapsed } from '../hooks/useElapsed'
import type { LobbySnapshot } from '../hooks/useLobby'
import { queueModes } from '../lib/modes'
import { formatDuration } from '../lib/teams'
import MatchTeamColumn from './MatchTeamColumn'
import WinChanceBar from './WinChanceBar'
import HexButton from './ui/HexButton'

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onVoteEnd: (value: boolean) => void
}

// Partida em andamento: painel de status (tempo de partida e votos para encerrar), a chance estimada e os dois times
// com o campeão de cada um, no mesmo estilo da seleção de campeões.
export default function LobbyPlaying({ lobby, skew, busy, onVoteEnd }: Props) {
  const { match } = lobby
  const elapsed = useElapsed(match.startedAt, skew)
  const progress = Math.min(100, (match.endVotes / match.votesNeeded) * 100)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-rim bg-void/40 px-4 py-3 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-hex-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hex-300 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-hex-300" />
            </span>
            Partida em andamento
          </p>
          <p className="font-cond text-5xl font-bold leading-none tabular-nums text-gold-50" aria-label="Tempo de partida">
            {formatDuration(elapsed)}
          </p>
          <p className="mt-1 text-sm text-ash">
            {queueModes[lobby.mode ?? 'vote'].name}
            {match.gameNumber > 1 && ' · lados trocados'}
          </p>
        </div>

        {/* Encerrar: cada um declara o fim; com votos suficientes, vai para o resultado */}
        <div className="flex flex-col gap-2 md:w-80">
          <HexButton
            variant={match.iVotedEnd ? 'secondary' : 'primary'}
            onClick={() => onVoteEnd(!match.iVotedEnd)}
            disabled={busy}
            className="w-full"
          >
            {match.iVotedEnd ? 'Desfazer meu voto' : 'Declarar fim da partida'}
          </HexButton>
          <div>
            <div
              role="progressbar"
              aria-label="Votos para encerrar"
              aria-valuemin={0}
              aria-valuemax={match.votesNeeded}
              aria-valuenow={match.endVotes}
              className="h-1.5 w-full overflow-hidden rounded-full bg-rim"
            >
              <div className="h-full rounded-full bg-gold-200 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-ash">
              <span className="font-cond text-sm font-semibold tabular-nums text-gold-50">
                {match.endVotes}/{match.votesNeeded}
              </span>{' '}
              votos para encerrar
            </p>
          </div>
        </div>
      </div>

      <WinChanceBar lobby={lobby} />

      <div className="grid items-start gap-3 md:grid-cols-2">
        <MatchTeamColumn lobby={lobby} side="blue" />
        <MatchTeamColumn lobby={lobby} side="red" />
      </div>
    </div>
  )
}
