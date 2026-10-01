import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LobbyCaptains from '../components/LobbyCaptains'
import LobbyCoinFlip from '../components/LobbyCoinFlip'
import LobbyDraft from '../components/LobbyDraft'
import LobbyFinished from '../components/LobbyFinished'
import LobbyMvp from '../components/LobbyMvp'
import LobbyPlaying from '../components/LobbyPlaying'
import LobbyRematch from '../components/LobbyRematch'
import LobbyResult from '../components/LobbyResult'
import LobbySide from '../components/LobbySide'
import LobbyVoting from '../components/LobbyVoting'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import HexButton from '../components/ui/HexButton'
import Notice from '../components/ui/Notice'
import { useLobby, type LobbyPhase } from '../hooks/useLobby'
import { pageSplash } from '../lib/ddragon'

// Etapas mostradas no topo, na ordem do lobby. Cada fase do servidor cai em uma delas.
const stages: { label: string; phases: LobbyPhase[] }[] = [
  { label: 'Capitães', phases: ['voting', 'captains'] },
  { label: 'Sorteio', phases: ['coinflip', 'side'] },
  { label: 'Draft', phases: ['picking', 'done'] },
  { label: 'Partida', phases: ['playing'] },
  { label: 'Resultado', phases: ['result', 'mvp'] },
  { label: 'Fim', phases: ['finished', 'rematch'] },
]

function StageBar({ phase }: { phase: LobbyPhase }) {
  const current = stages.findIndex((s) => s.phases.includes(phase))
  return (
    <ol className="grid grid-cols-6 gap-1" aria-label="Etapas do lobby">
      {stages.map((stage, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'next'
        return (
          <li key={stage.label} aria-current={state === 'current' ? 'step' : undefined} className="min-w-0">
            {/* Trilho + preenchimento que cresce da esquerda quando a etapa começa. */}
            <div className="relative h-1 overflow-hidden rounded-full bg-rim">
              <div
                className={`absolute inset-0 origin-left transition-[transform,background-color] duration-500 ease-out ${
                  state === 'next' ? 'scale-x-0' : 'scale-x-100'
                } ${state === 'current' ? 'bg-gold-200' : 'bg-gold-500'}`}
              />
            </div>
            <p
              className={`mt-1.5 truncate text-center font-display text-xs transition-colors duration-500 sm:text-sm ${
                state === 'current' ? 'text-gold-50' : state === 'done' ? 'text-gold-200/70' : 'text-ash-dim'
              }`}
            >
              {stage.label}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

export default function Lobby() {
  const {
    lobby,
    notice,
    skew,
    connected,
    busy,
    error,
    vote,
    chooseSide,
    pick,
    voteEnd,
    voteResult,
    voteMvp,
    voteRematch,
    leave,
  } = useLobby()
  const navigate = useNavigate()
  const [confirmingLeave, setConfirmingLeave] = useState(false)

  // Sem lobby (nunca entrou, ou foi cancelado): volta para o início, avisando o motivo se houver.
  useEffect(() => {
    if (lobby === null) navigate('/', { replace: true, state: notice ? { notice } : undefined })
  }, [lobby, notice, navigate])

  if (!lobby) return <p className="text-ash">Carregando lobby...</p>

  const finished = lobby.phase === 'finished'
  const rematching = lobby.phase === 'rematch'
  // Durante a partida não dá para sair (o servidor também bloqueia).
  const inMatch = lobby.phase === 'playing' || lobby.phase === 'result' || lobby.phase === 'mvp'

  // Antes da partida começar, sair cancela o lobby para todos (na contagem da revanche, cancela a revanche):
  // por isso pede confirmação. Depois da partida, cada um sai por si, sem perguntar.
  function handleLeave() {
    if (finished) leave()
    else setConfirmingLeave(true)
  }

  function confirmLeave() {
    setConfirmingLeave(false)
    leave()
  }

  return (
    <div className="space-y-3">
      {/* Faixa única: título, etapas e o botão de sair (para sobrar altura para a fase). */}
      <div className="relative isolate flex flex-wrap items-center gap-x-6 gap-y-3 overflow-hidden rounded-xl border border-rim bg-abyss px-4 py-3">
        <img
          src={pageSplash.lobby}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_25%] opacity-25"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-void via-void/70 to-void/40" />
        <h1 className="font-display text-xl leading-none text-gold-50">
          Lobby
          {lobby.match.gameNumber > 1 && (
            <span className="ml-2 font-cond text-sm font-semibold text-gold-200">Partida {lobby.match.gameNumber}</span>
          )}
        </h1>
        <div className="order-last w-full md:order-0 md:w-auto md:flex-1">
          <StageBar phase={lobby.phase} />
        </div>
        {!inMatch && (
          <HexButton
            variant="secondary"
            size="sm"
            onClick={handleLeave}
            disabled={busy}
            className="ml-auto md:ml-0"
          >
            {finished ? 'Voltar ao início' : 'Sair do lobby'}
          </HexButton>
        )}
      </div>

      {error && <Notice>{error}</Notice>}
      {!connected && <Notice tone="warning">Conexão perdida. Reconectando...</Notice>}

      <section className="rounded-xl border border-rim bg-abyss p-4 sm:px-5">
        {/* A key muda a cada fase, então o conteúdo novo entra com animação (só na troca de fase, não a cada voto/pick). */}
        <div key={lobby.phase === 'done' ? 'picking' : lobby.phase} className="animate-phase-in">
          {lobby.phase === 'voting' && <LobbyVoting lobby={lobby} skew={skew} busy={busy} onVote={vote} />}
          {lobby.phase === 'captains' && <LobbyCaptains lobby={lobby} skew={skew} />}
          {lobby.phase === 'coinflip' && <LobbyCoinFlip lobby={lobby} skew={skew} />}
          {lobby.phase === 'side' && <LobbySide lobby={lobby} skew={skew} busy={busy} onChoose={chooseSide} />}
          {(lobby.phase === 'picking' || lobby.phase === 'done') && (
            <LobbyDraft lobby={lobby} skew={skew} busy={busy} onPick={pick} />
          )}
          {lobby.phase === 'playing' && <LobbyPlaying lobby={lobby} skew={skew} busy={busy} onVoteEnd={voteEnd} />}
          {lobby.phase === 'result' && <LobbyResult lobby={lobby} skew={skew} busy={busy} onVote={voteResult} />}
          {lobby.phase === 'mvp' && <LobbyMvp lobby={lobby} skew={skew} busy={busy} onVote={voteMvp} />}
          {finished && <LobbyFinished lobby={lobby} skew={skew} busy={busy} onRematch={voteRematch} />}
          {rematching && <LobbyRematch lobby={lobby} skew={skew} />}
        </div>
      </section>

      <ConfirmDialog
        open={confirmingLeave}
        title={rematching ? 'Cancelar a revanche?' : 'Sair do lobby?'}
        confirmLabel={rematching ? 'Sair e cancelar' : 'Sair do lobby'}
        cancelLabel="Ficar"
        confirmVariant="danger"
        busy={busy}
        onConfirm={confirmLeave}
        onCancel={() => setConfirmingLeave(false)}
      >
        <p className="text-sm text-ash">
          {rematching
            ? 'Se você sair agora, a revanche é cancelada para todos os jogadores.'
            : 'Se você sair agora, o lobby é cancelado para todos os jogadores e cada um volta para o início.'}
        </p>
      </ConfirmDialog>
    </div>
  )
}
