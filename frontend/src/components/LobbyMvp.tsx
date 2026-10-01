import { useCallback, useState } from 'react'
import type { LobbyPlayer, LobbySnapshot, Side } from '../hooks/useLobby'
import { sideStyle, splitRiotId } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import { CaptainBadge, YouBadge } from './ui/Badges'
import ConfirmDialog from './ui/ConfirmDialog'
import PlayerTile from './ui/PlayerTile'
import SectionTitle from './ui/SectionTitle'
import SummonerIcon from './ui/SummonerIcon'

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onVote: (playerId: number) => void
}

export default function LobbyMvp({ lobby, skew, busy, onVote }: Props) {
  const { match } = lobby
  const winnerSide = match.outcome as Side
  const style = sideStyle[winnerSide]
  const candidates = lobby.players.filter((p) => match.mvpCandidates.includes(p.id))

  // Jogador escolhido aguardando confirmação no modal.
  const [pending, setPending] = useState<LobbyPlayer | null>(null)
  const voted = match.myMvpVote !== null
  const closeDialog = useCallback(() => setPending(null), [])

  function confirmVote() {
    if (!pending) return
    onVote(pending.id)
    setPending(null)
  }

  const [pendingName, pendingTag] = pending ? splitRiotId(pending.riotId) : ['', '']

  return (
    <div className="space-y-4">
      <SectionTitle title="Quem foi o MVP?">
        <span className={`font-semibold ${style.text}`}>Vitória do {style.name}.</span>{' '}
        {voted
          ? 'Voto registrado. Agora é esperar os outros jogadores.'
          : 'Escolha o melhor jogador do time vencedor (não vale votar em si mesmo). Você vota uma vez só e os votos ficam secretos até o fim.'}
      </SectionTitle>

      <PhaseTimer
        endsAt={lobby.endsAt}
        durationMs={lobby.durationMs}
        skew={skew}
        label={`${match.mvpVotedCount} de ${lobby.players.length} jogadores já votaram`}
      />

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {candidates.map((player) => {
          const selected = match.myMvpVote === player.id
          return (
            <li key={player.id}>
              <PlayerTile
                riotId={player.riotId}
                iconId={player.iconId}
                ring={style.ring}
                selected={selected}
                // Depois de votar (ou no próprio cartão), fica só leitura; o escolhido continua destacado.
                dimmed={player.isYou || (voted && !selected)}
                onClick={voted || player.isYou ? undefined : () => setPending(player)}
                disabled={busy}
                footer={
                  (player.isYou || player.isCaptain || selected) && (
                    <>
                      {player.isYou && <YouBadge />}
                      {player.isCaptain && <CaptainBadge withLabel={false} />}
                      {selected && <span className="text-xs font-semibold text-gold-200">Seu voto</span>}
                    </>
                  )
                }
              />
            </li>
          )
        })}
      </ul>

      <p className="text-center text-sm text-ash">O mais votado vira MVP; empate é sorteado.</p>

      <ConfirmDialog
        open={pending !== null}
        title="Confirmar voto de MVP?"
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
              Esse jogador vai receber o seu voto para MVP.{' '}
              <span className="font-semibold text-gold-200">O voto não pode ser alterado.</span>
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
