import { useElapsed } from '../hooks/useElapsed'
import type { LobbySnapshot, Side } from '../hooks/useLobby'
import { queueModes } from '../lib/modes'
import { formatDuration, sideStyle, splitRiotId, teamMembers } from '../lib/teams'
import TeamCard from './TeamCard'
import { YouBadge } from './ui/Badges'
import type { LobbyPlayer } from '../hooks/useLobby'
import type { ReactNode } from 'react'
import HexButton from './ui/HexButton'
import { FishIcon, StarIcon } from './ui/icons'
import SummonerIcon, { type IconRing } from './ui/SummonerIcon'

// Destaque da partida (MVP ou bagre) com o número de votos que recebeu.
function AwardCard({
  player,
  votes,
  label,
  icon,
  ring,
  classes,
  empty,
}: {
  player: LobbyPlayer | undefined
  votes: number
  label: string
  icon: ReactNode
  ring: IconRing
  classes: string
  empty: string
}) {
  return (
    <div className={`flex min-w-60 flex-1 items-center gap-3 rounded-xl border px-4 py-3 ${classes}`}>
      {player ? (
        <>
          <SummonerIcon iconId={player.iconId} size="lg" ring={ring} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-display text-sm">
              {icon} {label}
            </p>
            <p className="truncate font-display text-2xl leading-tight text-gold-50">{splitRiotId(player.riotId)[0]}</p>
            <p className="flex items-center gap-2 text-sm text-ash">
              {votes} {votes === 1 ? 'voto' : 'votos'}
              {player.isYou && <YouBadge />}
            </p>
          </div>
        </>
      ) : (
        <p className="w-full text-center text-sm text-ash">{empty}</p>
      )}
    </div>
  )
}

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onRematch: (value: boolean) => void
  onRequeue: () => void
}

// Tela de fim de jogo, no estilo "Vitória / Derrota" do LoL.
export default function LobbyFinished({ lobby, skew, busy, onRematch, onRequeue }: Props) {
  const { match } = lobby
  const duration = useElapsed(match.startedAt, skew, match.endedAt)
  const me = lobby.players.find((p) => p.isYou)
  const remake = match.outcome === 'remake'
  const winnerSide = remake ? null : (match.outcome as Side)
  const won = !remake && me?.team === winnerSide
  const mvp = lobby.players.find((p) => p.id === match.mvpId)
  const mvpVotes = mvp && match.mvpCounts ? (match.mvpCounts[mvp.id] ?? 0) : 0
  const bagre = lobby.players.find((p) => p.id === match.bagreId)
  const bagreVotes = bagre && match.bagreCounts ? (match.bagreCounts[bagre.id] ?? 0) : 0

  const headline = remake ? 'Remake' : won ? 'Vitória' : 'Derrota'
  const headlineColor = remake ? 'text-gold-50' : won ? 'text-hex-100' : 'text-team-red'

  const rematchProgress = Math.min(100, (match.rematchVotes / match.votesNeeded) * 100)

  return (
    <div className="space-y-4">
      {/* Resultado, MVP e bagre lado a lado */}
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
          <div className="flex flex-wrap gap-3">
            <AwardCard
              player={mvp}
              votes={mvpVotes}
              label="MVP da partida"
              icon={<StarIcon className="h-4 w-4" />}
              ring="gold"
              classes="border-gold-200/40 bg-gold-200/[0.06] text-gold-200"
              empty="Ninguém votou, então não houve MVP."
            />
            <AwardCard
              player={bagre}
              votes={bagreVotes}
              label="Bagre da partida"
              icon={<FishIcon className="h-4 w-4" />}
              ring="bagre"
              classes="border-bagre/40 bg-bagre/[0.06] text-bagre"
              empty="Ninguém votou, então não houve bagre."
            />
          </div>
        )}
      </div>

      <div className="grid items-start gap-3 md:grid-cols-2">
        {(['blue', 'red'] as Side[]).map((side) => (
          <TeamCard
            key={side}
            side={side}
            members={teamMembers(lobby, side)}
            mvpId={match.mvpId}
            bagreId={match.bagreId}
            winner={winnerSide === side}
          />
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

      {/* Sair e já procurar outra partida, no mesmo modo de fila. */}
      <div className="flex flex-col items-center gap-1.5 border-t border-rim pt-4">
        <HexButton variant="secondary" onClick={onRequeue} disabled={busy}>
          Entrar na fila novamente
        </HexButton>
        <p className="text-xs text-ash">
          Sai do lobby e entra na fila do {queueModes[lobby.mode ?? 'vote'].name.toLowerCase()}.
        </p>
      </div>
    </div>
  )
}
