import { useCallback, useState } from 'react'
import type { LobbyPlayer, LobbySnapshot } from '../hooks/useLobby'
import { splitRiotId } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import { YouBadge } from './ui/Badges'
import EloBadge from './ui/EloBadge'
import RankBadge from './ui/RankBadge'
import ConfirmDialog from './ui/ConfirmDialog'
import { CheckIcon } from './ui/icons'
import PlayerTile from './ui/PlayerTile'
import SectionTitle from './ui/SectionTitle'
import SummonerIcon from './ui/SummonerIcon'

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onVote: (playerId: number) => void
}

export default function LobbyVoting({ lobby, skew, busy, onVote }: Props) {
  // Jogador escolhido aguardando confirmação no modal.
  const [pending, setPending] = useState<LobbyPlayer | null>(null)
  const voted = lobby.myVote !== null
  const closeDialog = useCallback(() => setPending(null), [])

  function confirmVote() {
    if (!pending) return
    onVote(pending.id)
    setPending(null)
  }

  const [pendingName, pendingTag] = pending ? splitRiotId(pending.riotId) : ['', '']

  return (
    <div className="space-y-4">
      <SectionTitle title="Vote no seu capitão">
        {voted
          ? 'Voto registrado. Agora é esperar os outros jogadores.'
          : 'Os 2 mais votados lideram os times. Você vota uma vez só e os votos ficam secretos até o fim.'}
      </SectionTitle>

      <PhaseTimer
        endsAt={lobby.endsAt}
        durationMs={lobby.durationMs}
        skew={skew}
        label={`${lobby.votedCount} de ${lobby.players.length} jogadores já votaram`}
      />

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {lobby.players.map((player) => {
          const selected = lobby.myVote === player.id
          return (
            <li key={player.id}>
              <PlayerTile
                riotId={player.riotId}
                iconId={player.iconId}
                selected={selected}
                // Depois de votar, os cartões viram só leitura; o escolhido continua destacado.
                dimmed={voted && !selected}
                onClick={voted ? undefined : () => setPending(player)}
                disabled={busy}
                footer={
                  (player.isYou || selected || player.rankPosition != null || player.elo) && (
                    <>
                      <RankBadge position={player.rankPosition} />
                      <EloBadge elo={player.elo} compact />
                      {player.isYou && <YouBadge />}
                      {selected && <span className="text-xs font-semibold text-gold-200">Seu voto</span>}
                    </>
                  )
                }
                corner={
                  player.hasVoted && (
                    <span title="Já votou" className="grid h-5 w-5 place-items-center rounded-full bg-hex-900 text-hex-300">
                      <CheckIcon className="h-3 w-3" />
                      <span className="sr-only">Já votou</span>
                    </span>
                  )
                }
              />
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        title="Confirmar voto?"
        confirmLabel="Confirmar voto"
        busy={busy}
        onConfirm={confirmVote}
        onCancel={closeDialog}
      >
        {pending && (
          <div className="flex flex-col items-center gap-2">
            <SummonerIcon iconId={pending.iconId} size="xl" ring="gold" />
            <p className="mt-1 font-display text-2xl text-gold-50">
              {pendingName}
              <span className="ml-1 font-sans text-base font-normal text-ash">#{pendingTag}</span>
            </p>
            <p className="text-sm text-ash">
              {pending.isYou ? 'Você vai votar em si mesmo para capitão.' : 'Esse jogador vai receber o seu voto para capitão.'}{' '}
              <span className="font-semibold text-gold-200">O voto não pode ser alterado.</span>
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
