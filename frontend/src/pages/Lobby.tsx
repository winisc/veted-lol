import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LobbyAramTeams from '../components/LobbyAramTeams'
import LobbyAwardVote from '../components/LobbyAwardVote'
import LobbyChampSelect from '../components/LobbyChampSelect'
import LobbyStats from '../components/LobbyStats'
import LobbyCaptains from '../components/LobbyCaptains'
import LobbyCoinFlip from '../components/LobbyCoinFlip'
import LobbyDraft from '../components/LobbyDraft'
import LobbyOrder from '../components/LobbyOrder'
import LobbyFinished from '../components/LobbyFinished'
import LobbyPlaying from '../components/LobbyPlaying'
import LobbyRematch from '../components/LobbyRematch'
import LobbyResult from '../components/LobbyResult'
import LobbySide from '../components/LobbySide'
import LobbyVoting from '../components/LobbyVoting'
import { ReactionBar, ReactionFeed } from '../components/Reactions'
import { ReactionsContext } from '../lib/reactions'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import HexButton from '../components/ui/HexButton'
import Notice from '../components/ui/Notice'
import { useQueue } from '../context/QueueContext'
import { useLobby, type LobbyPhase } from '../hooks/useLobby'
import { useLobbySounds } from '../hooks/useLobbySounds'
import { pageSplash } from '../lib/ddragon'
import { isAramMode, queueModes } from '../lib/modes'

// Etapas mostradas no topo, na ordem do lobby. Cada fase do servidor cai em uma delas.
const stages: { label: string; phases: LobbyPhase[] }[] = [
  { label: 'Capitães', phases: ['voting', 'captains'] },
  { label: 'Sorteio', phases: ['coinflip', 'order', 'side'] },
  { label: 'Draft', phases: ['picking', 'done'] },
  { label: 'Campeões', phases: ['bans', 'champs', 'finalize'] },
  { label: 'Partida', phases: ['playing'] },
  { label: 'Resultado', phases: ['result', 'stats', 'mvp', 'bagre'] },
  { label: 'Fim', phases: ['finished', 'rematch'] },
]

// ARAM: sem capitães nem draft, os times já vêm sorteados.
const aramStages: { label: string; phases: LobbyPhase[] }[] = [
  { label: 'Times', phases: ['teams'] },
  ...stages.filter((s) => ['Partida', 'Resultado', 'Fim'].includes(s.label)),
]

function StageBar({ phase, aram }: { phase: LobbyPhase; aram: boolean }) {
  const list = aram ? aramStages : stages
  const current = list.findIndex((s) => s.phases.includes(phase))
  return (
    <ol className={`grid gap-1 ${aram ? 'grid-cols-4' : 'grid-cols-7'}`} aria-label="Etapas do lobby">
      {list.map((stage, i) => {
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
    chooseOrder,
    chooseSide,
    pick,
    confirmTeams,
    banChampion,
    pickChampion,
    hoverChampion,
    requestTrade,
    answerTrade,
    cancelTrade,
    voteEnd,
    voteResult,
    voteMvp,
    voteBagre,
    submitStats,
    skipStats,
    leave,
    reactions,
    react,
  } = useLobby()
  const navigate = useNavigate()
  useLobbySounds(lobby, skew)
  const queue = useQueue()
  const [confirmingLeave, setConfirmingLeave] = useState(false)

  // Sem lobby (nunca entrou, ou foi cancelado): volta para o início, avisando o motivo se houver.
  useEffect(() => {
    if (lobby === null) navigate('/', { replace: true, state: notice ? { notice } : undefined })
  }, [lobby, notice, navigate])

  if (!lobby) return <p className="text-ash">Carregando lobby...</p>

  const finished = lobby.phase === 'finished'
  const rematching = lobby.phase === 'rematch'
  // Durante a partida não dá para sair (o servidor também bloqueia).
  const inMatch =
    lobby.phase === 'playing' || lobby.phase === 'result' || lobby.phase === 'stats' || lobby.phase === 'mvp' || lobby.phase === 'bagre'

  // Antes da partida começar, sair cancela o lobby para todos (na contagem da revanche, cancela a revanche):
  // por isso pede confirmação. Depois da partida, cada um sai por si, sem perguntar.
  function handleLeave() {
    if (finished) leave()
    else setConfirmingLeave(true)
  }

  // Fim de jogo: sai do lobby e já entra na fila do mesmo modo.
  async function requeue() {
    const mode = lobby!.mode ?? 'vote'
    if (await leave()) await queue.join(mode)
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
          <span className="ml-2 rounded bg-gold-200/15 px-1.5 py-0.5 align-middle font-sans text-xs font-semibold text-gold-200">
            {queueModes[lobby.mode ?? 'vote'].short}
          </span>
        </h1>
        <div className="order-last w-full md:order-0 md:w-auto md:flex-1">
          <StageBar phase={lobby.phase} aram={isAramMode(lobby.mode)} />
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

      <ReactionsContext.Provider value={reactions}>
        <section className="rounded-xl border border-rim bg-abyss p-4 sm:px-5">
          {/* A key muda a cada fase, então o conteúdo novo entra com animação (só na troca de fase, não a cada voto/pick). */}
          <div key={lobby.phase === 'done' ? 'picking' : lobby.phase} className="animate-phase-in">
            {lobby.phase === 'teams' && <LobbyAramTeams lobby={lobby} skew={skew} />}
          {lobby.phase === 'voting' && <LobbyVoting lobby={lobby} skew={skew} busy={busy} onVote={vote} />}
            {lobby.phase === 'captains' && <LobbyCaptains lobby={lobby} skew={skew} />}
            {lobby.phase === 'coinflip' && <LobbyCoinFlip lobby={lobby} skew={skew} />}
            {lobby.phase === 'order' && <LobbyOrder lobby={lobby} skew={skew} busy={busy} onChoose={chooseOrder} />}
            {lobby.phase === 'side' && <LobbySide lobby={lobby} skew={skew} busy={busy} onChoose={chooseSide} />}
            {(lobby.phase === 'picking' || lobby.phase === 'done') && (
              <LobbyDraft lobby={lobby} skew={skew} busy={busy} onPick={pick} onConfirm={confirmTeams} />
            )}
            {(lobby.phase === 'bans' || lobby.phase === 'champs' || lobby.phase === 'finalize') && lobby.champSelect && (
            <LobbyChampSelect
              lobby={lobby}
              skew={skew}
              busy={busy}
              onBan={banChampion}
              onPick={pickChampion}
              onHover={hoverChampion}
              onTrade={requestTrade}
              onTradeAnswer={answerTrade}
              onTradeCancel={cancelTrade}
            />
          )}
          {lobby.phase === 'playing' && <LobbyPlaying lobby={lobby} skew={skew} busy={busy} onVoteEnd={voteEnd} />}
            {lobby.phase === 'result' && <LobbyResult lobby={lobby} skew={skew} busy={busy} onVote={voteResult} />}
            {lobby.phase === 'stats' && (
            <LobbyStats lobby={lobby} busy={busy} onSubmit={submitStats} onSkip={skipStats} />
          )}
          {lobby.phase === 'mvp' && <LobbyAwardVote kind="mvp" lobby={lobby} skew={skew} busy={busy} onVote={voteMvp} />}
            {lobby.phase === 'bagre' && (
              <LobbyAwardVote kind="bagre" lobby={lobby} skew={skew} busy={busy} onVote={voteBagre} />
            )}
            {finished && <LobbyFinished lobby={lobby} skew={skew} busy={busy || queue.busy} onRequeue={requeue} onLeave={leave} />}
            {rematching && <LobbyRematch lobby={lobby} skew={skew} />}
          </div>
        </section>

        {/* Reações rápidas (só no draft): aparecem por cima do ícone de quem mandou e no canto da tela */}
        {['picking', 'done', 'teams', 'bans', 'champs', 'finalize'].includes(lobby.phase) && (
          <div className="flex justify-center">
            <ReactionBar onReact={react} />
          </div>
        )}
        <ReactionFeed items={reactions} players={lobby.players} />
      </ReactionsContext.Provider>

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
