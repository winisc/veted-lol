import { useCallback, useState, type ReactNode } from 'react'
import type { LobbyPlayer, LobbySnapshot, Side } from '../hooks/useLobby'
import { sideStyle, splitRiotId } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import { CaptainBadge, YouBadge } from './ui/Badges'
import ConfirmDialog from './ui/ConfirmDialog'
import { FishIcon, StarIcon } from './ui/icons'
import PlayerTile from './ui/PlayerTile'
import SectionTitle from './ui/SectionTitle'
import SummonerIcon from './ui/SummonerIcon'
import type { IconRing } from './ui/SummonerIcon'

export type AwardKind = 'mvp' | 'bagre'

// Textos e cores de cada votação. As duas têm voto único e secreto; só no bagre dá para votar em si mesmo.
const awards: Record<
  AwardKind,
  {
    title: string
    instructions: string
    footer: string
    confirmTitle: string
    confirmText: string
    accent: string
    selfVote: boolean // pode votar em si mesmo
    ring: IconRing
    icon: ReactNode
  }
> = {
  mvp: {
    title: 'Quem foi o MVP?',
    instructions: 'Escolha o melhor jogador do time vencedor (não vale votar em si mesmo).',
    footer: 'O mais votado vira MVP; empate é sorteado.',
    confirmTitle: 'Confirmar voto de MVP?',
    confirmText: 'Esse jogador vai receber o seu voto para MVP.',
    accent: 'text-gold-200',
    selfVote: false,
    ring: 'gold',
    icon: <StarIcon className="h-4 w-4" />,
  },
  bagre: {
    title: 'Quem foi o bagre?',
    instructions: 'Escolha o pior jogador do time que perdeu (vale votar em si mesmo).',
    footer: 'O mais votado vira o bagre da partida e perde pontos na tabela; empate é sorteado.',
    confirmTitle: 'Confirmar voto de bagre?',
    confirmText: 'Esse jogador vai receber o seu voto para bagre.',
    accent: 'text-bagre',
    selfVote: true,
    ring: 'bagre',
    icon: <FishIcon className="h-4 w-4" />,
  },
}

interface Props {
  kind: AwardKind
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onVote: (playerId: number) => void
}

export default function LobbyAwardVote({ kind, lobby, skew, busy, onVote }: Props) {
  const award = awards[kind]
  const { match } = lobby
  const winnerSide = match.outcome as Side
  // Candidatos: MVP sai do time vencedor; bagre, do perdedor.
  const side: Side = kind === 'mvp' ? winnerSide : winnerSide === 'blue' ? 'red' : 'blue'
  const style = sideStyle[side]
  const candidateIds = kind === 'mvp' ? match.mvpCandidates : match.bagreCandidates
  const myVote = kind === 'mvp' ? match.myMvpVote : match.myBagreVote
  const votedCount = kind === 'mvp' ? match.mvpVotedCount : match.bagreVotedCount
  const candidates = lobby.players.filter((p) => candidateIds.includes(p.id))

  // Jogador escolhido aguardando confirmação no modal.
  const [pending, setPending] = useState<LobbyPlayer | null>(null)
  const voted = myVote !== null
  const closeDialog = useCallback(() => setPending(null), [])

  function confirmVote() {
    if (!pending) return
    onVote(pending.id)
    setPending(null)
  }

  const [pendingName, pendingTag] = pending ? splitRiotId(pending.riotId) : ['', '']

  return (
    <div className="space-y-4">
      <SectionTitle
        title={
          <span className="inline-flex items-center gap-2">
            <span className={award.accent}>{award.icon}</span>
            {award.title}
          </span>
        }
      >
        <span className={`font-semibold ${sideStyle[winnerSide].text}`}>Vitória do {sideStyle[winnerSide].name}.</span>{' '}
        {voted
          ? 'Voto registrado. Agora é esperar os outros jogadores.'
          : `${award.instructions} Você vota uma vez só e os votos ficam secretos até o fim.`}
      </SectionTitle>

      <PhaseTimer
        endsAt={lobby.endsAt}
        durationMs={lobby.durationMs}
        skew={skew}
        label={`${votedCount} de ${lobby.players.length} jogadores já votaram`}
      />

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {candidates.map((player) => {
          const selected = myVote === player.id
          const blocked = player.isYou && !award.selfVote
          return (
            <li key={player.id}>
              <PlayerTile
                riotId={player.riotId}
                iconId={player.iconId}
                ring={style.ring}
                selected={selected}
                // Depois de votar (ou no próprio cartão), fica só leitura; o escolhido continua destacado.
                dimmed={blocked || (voted && !selected)}
                onClick={voted || blocked ? undefined : () => setPending(player)}
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

      <p className="text-center text-sm text-ash">{award.footer}</p>

      <ConfirmDialog
        open={pending !== null}
        title={award.confirmTitle}
        confirmLabel="Confirmar voto"
        busy={busy}
        onConfirm={confirmVote}
        onCancel={closeDialog}
      >
        {pending && (
          <div className="flex flex-col items-center gap-2">
            <SummonerIcon iconId={pending.iconId} size="xl" ring={award.ring} />
            <p className="mt-1 font-display text-2xl text-gold-50">
              {pendingName}
              <span className="ml-1 font-sans text-base font-normal text-ash">#{pendingTag}</span>
            </p>
            <p className="text-sm text-ash">
              {pending.isYou ? 'Você vai votar em si mesmo.' : award.confirmText} <span className="font-semibold text-gold-200">O voto não pode ser alterado.</span>
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
