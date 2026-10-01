import { useElapsed } from '../hooks/useElapsed'
import type { LobbySnapshot, Side } from '../hooks/useLobby'
import { formatDuration, sideStyle, splitRiotId, teamMembers } from '../lib/teams'
import TeamCard from './TeamCard'
import { YouBadge } from './ui/Badges'
import HexButton from './ui/HexButton'
import { StarIcon } from './ui/icons'
import SummonerIcon from './ui/SummonerIcon'

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onRematch: (value: boolean) => void
}

// Tela de fim de jogo, no estilo "Vitória / Derrota" do LoL.
export default function LobbyFinished({ lobby, skew, busy, onRematch }: Props) {
  const { match } = lobby
  const duration = useElapsed(match.startedAt, skew, match.endedAt)
  const me = lobby.players.find((p) => p.isYou)
  const remake = match.outcome === 'remake'
  const winnerSide = remake ? null : (match.outcome as Side)
  const won = !remake && me?.team === winnerSide
  const mvp = lobby.players.find((p) => p.id === match.mvpId)
  const mvpVotes = mvp && match.mvpCounts ? (match.mvpCounts[mvp.id] ?? 0) : 0

  const headline = remake ? 'Remake' : won ? 'Vitória' : 'Derrota'
  const headlineColor = remake ? 'text-gold-50' : won ? 'text-hex-100' : 'text-team-red'

  const rematchProgress = Math.min(100, (match.rematchVotes / match.votesNeeded) * 100)

  return (
    <div className="space-y-4">
      {/* Resultado e MVP lado a lado */}
      <div className="grid items-center gap-4 md:grid-cols-[1fr_auto]">
        <div className="text-center md:text-left">
          <p
            className={`font-display text-6xl leading-none ${headlineColor} ${won ? '' : ''}`}
          >
            {headline}
          </p>
          <p className="mt-2 text-sm text-ash">
            {remake
              ? 'Partida anulada. Não conta no histórico de ninguém.'
              : `${sideStyle[winnerSide!].name} venceu. Resultado salvo no histórico.`}{' '}
            Duração <span className="font-cond font-semibold tabular-nums text-gold-50">{formatDuration(duration)}</span>.
          </p>
        </div>

        {!remake && (
          <div className="flex min-w-72 items-center gap-4 rounded-xl border border-gold-200/40 bg-gold-200/[0.06] px-4 py-3">
            {mvp ? (
              <>
                <SummonerIcon iconId={mvp.iconId} size="lg" ring="gold" glow />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-display text-sm text-gold-200">
                    <StarIcon className="h-4 w-4" /> MVP da partida
                  </p>
                  <p className="truncate font-display text-2xl leading-tight text-gold-50">{splitRiotId(mvp.riotId)[0]}</p>
                  <p className="flex items-center gap-2 text-sm text-ash">
                    {mvpVotes} {mvpVotes === 1 ? 'voto' : 'votos'}
                    {mvp.isYou && <YouBadge />}
                  </p>
                </div>
              </>
            ) : (
              <p className="w-full text-center text-sm text-ash">Ninguém votou, então não houve MVP.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid items-start gap-3 md:grid-cols-2">
        {(['blue', 'red'] as Side[]).map((side) => (
          <TeamCard key={side} side={side} members={teamMembers(lobby, side)} mvpId={match.mvpId} winner={winnerSide === side} />
        ))}
      </div>

      {/* Revanche: botão e progresso lado a lado */}
      {match.rematchAvailable ? (
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-t border-rim pt-4 sm:flex-row sm:gap-5">
          <HexButton
            variant={match.iVotedRematch ? 'secondary' : 'primary'}
            onClick={() => onRematch(!match.iVotedRematch)}
            disabled={busy}
            className="shrink-0"
          >
            {match.iVotedRematch ? 'Desfazer meu voto' : 'Jogar novamente'}
          </HexButton>
          <div className="w-full flex-1">
            <div
              role="progressbar"
              aria-label="Votos para jogar novamente"
              aria-valuemin={0}
              aria-valuemax={match.votesNeeded}
              aria-valuenow={match.rematchVotes}
              className="h-1 w-full bg-rim"
            >
              <div className="h-full bg-gold-200 transition-all duration-500" style={{ width: `${rematchProgress}%` }} />
            </div>
            <p className="mt-1.5 text-sm text-ash">
              <span className="font-cond text-base font-semibold text-gold-50">
                {match.rematchVotes}/{match.votesNeeded}
              </span>{' '}
              votos para jogar de novo, com os lados trocados
            </p>
          </div>
        </div>
      ) : (
        <p className="border-t border-rim pt-4 text-center text-sm text-ash">
          Alguém já saiu do lobby, então não dá para jogar novamente.
        </p>
      )}
    </div>
  )
}
