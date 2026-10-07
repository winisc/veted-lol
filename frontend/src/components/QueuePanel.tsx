import { useEffect, useState } from 'react'
import { useQueue, type QueueSnapshot } from '../context/QueueContext'
import { queueModeOrder, queueModes, type QueueMode } from '../lib/modes'
import { formatDuration, splitRiotId } from '../lib/teams'
import HexButton, { HexLink } from './ui/HexButton'
import Notice from './ui/Notice'
import PlayerLink from './ui/PlayerLink'
import SummonerIcon from './ui/SummonerIcon'

// As 10 vagas da partida: ícone de quem já entrou, círculo vazio para quem falta.
function QueueSlots({ snapshot }: { snapshot: QueueSnapshot }) {
  const slots = Array.from({ length: snapshot.required }, (_, i) => snapshot.players[i] ?? null)

  return (
    <ul className="grid grid-cols-5 gap-x-2 gap-y-4 sm:gap-x-4" aria-label="Jogadores na fila">
      {slots.map((player, i) =>
        player ? (
          <li key={player.riotId} className="flex min-w-0 flex-col items-center gap-1.5" title={player.riotId}>
            {player.userId !== undefined ? (
              // Clicar no jogador abre o perfil dele.
              <PlayerLink userId={player.userId} className="flex w-full min-w-0 flex-col items-center gap-1.5 no-underline hover:no-underline">
                <SummonerIcon iconId={player.iconId} size="md" ring={player.isYou ? 'gold' : 'cyan'} glow={player.isYou} />
                <span className={`w-full truncate text-center text-xs ${player.isYou ? 'font-semibold text-gold-50' : 'text-ash'}`}>
                  {splitRiotId(player.riotId)[0]}
                </span>
              </PlayerLink>
            ) : (
              <>
                <SummonerIcon iconId={player.iconId} size="md" ring={player.isYou ? 'gold' : 'cyan'} glow={player.isYou} />
                <span className={`w-full truncate text-center text-xs ${player.isYou ? 'font-semibold text-gold-50' : 'text-ash'}`}>
                  {splitRiotId(player.riotId)[0]}
                </span>
              </>
            )}
          </li>
        ) : (
          <li key={`empty-${i}`} className="flex flex-col items-center gap-1.5">
            <span className="h-12 w-12 animate-pulse rounded-full border border-dashed border-hex-500/50 bg-hex-900/20" />
            <span className="text-xs text-ash-dim">Vaga</span>
          </li>
        ),
      )}
    </ul>
  )
}

function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return seconds
}

interface QueuedViewProps {
  snapshot: QueueSnapshot
  busy: boolean
  onLeave: () => void
  onSwitch: (mode: QueueMode) => void
}

function QueuedView({ snapshot, busy, onLeave, onSwitch }: QueuedViewProps) {
  const elapsed = useElapsedSeconds()
  const mode = snapshot.mode ?? 'vote'
  const other: QueueMode = mode === 'vote' ? 'ranked' : 'vote'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-display text-2xl text-gold-50">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hex-300 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-hex-300" />
            </span>
            Procurando partida
            <span className="rounded bg-gold-200/15 px-2 py-0.5 font-sans text-xs font-semibold text-gold-200">
              {queueModes[mode].name}
            </span>
          </p>
          <p className="mt-1 text-sm text-ash">
            Tempo na fila <span className="font-cond text-base font-semibold tabular-nums text-gold-50">{formatDuration(elapsed)}</span>
          </p>
        </div>
        <p className="font-cond text-5xl font-bold leading-none tabular-nums text-gold-50">
          {snapshot.size}
          <span className="text-2xl text-ash">/{snapshot.required}</span>
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Jogadores na fila"
        aria-valuemin={0}
        aria-valuemax={snapshot.required}
        aria-valuenow={snapshot.size}
        className="h-1.5 overflow-hidden rounded-full bg-rim"
      >
        <div
          className="h-full rounded-full bg-hex-300 transition-all duration-500"
          style={{ width: `${(snapshot.size / snapshot.required) * 100}%` }}
        />
      </div>

      <QueueSlots snapshot={snapshot} />

      <div className="flex flex-wrap items-center gap-3">
        <HexButton variant="secondary" onClick={onLeave} disabled={busy}>
          Sair da fila
        </HexButton>
        <button
          type="button"
          onClick={() => onSwitch(other)}
          disabled={busy}
          className="text-sm text-ash transition-colors hover:text-gold-50 disabled:opacity-50"
        >
          Trocar para o {queueModes[other].name.toLowerCase()} ({snapshot.sizes?.[other] ?? 0}/{snapshot.required})
        </button>
      </div>
    </div>
  )
}

// Botão pequeno "Entrar na espera": vai para a lista de espera do modo (até `max` pessoas), fora da fila.
function StandbyJoin({ waiting, max, busy, onClick }: { waiting: number; max: number; busy: boolean; onClick: () => void }) {
  const full = waiting >= max
  return (
    <div className="-mt-1 flex items-center justify-between gap-2 border-t border-rim pt-2.5 text-xs text-ash">
      <span>
        Lista de espera <span className="font-cond text-sm font-semibold tabular-nums text-gold-50">{waiting}/{max}</span>
      </span>
      <button
        type="button"
        onClick={onClick}
        disabled={busy || full}
        title="Fica de reserva: vê a fila e, quando for o primeiro da espera, pode entrar nela"
        className="rounded-md border border-rim bg-panel px-2.5 py-1 font-semibold text-gold-50 transition-colors hover:border-ash-dim disabled:opacity-50"
      >
        {full ? 'Espera cheia' : 'Entrar na espera'}
      </button>
    </div>
  )
}

// Fora da fila: um cartão por modo, cada um com a sua fila.
function ModePicker({
  snapshot,
  busy,
  onJoin,
  onStandby,
}: {
  snapshot: QueueSnapshot
  busy: boolean
  onJoin: (mode: QueueMode) => void
  onStandby: (mode: QueueMode) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {queueModeOrder.map((mode) => {
        const info = queueModes[mode]
        const waiting = snapshot.sizes?.[mode] ?? (snapshot.mode === mode ? snapshot.size : 0)
        return (
          <div key={mode} className="flex flex-col gap-3 rounded-xl border border-rim bg-abyss/85 p-4 backdrop-blur-sm">
            <div>
              <p className="font-display text-xl text-gold-50">{info.name}</p>
              <p className="mt-0.5 text-sm text-ash">{info.description}</p>
            </div>
            <div className="mt-auto flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-gold-50/80">
                <span className={`h-2 w-2 rounded-full ${waiting > 0 ? 'bg-hex-300' : 'bg-ash-dim'}`} />
                <span className="font-cond text-base font-semibold tabular-nums">
                  {waiting}/{snapshot.required}
                </span>
                na fila
              </span>
              <HexButton onClick={() => onJoin(mode)} disabled={busy}>
                Entrar na fila
              </HexButton>
            </div>
            {snapshot.standbyMax !== undefined && (
              <StandbyJoin
                waiting={snapshot.standbySizes?.[mode] ?? 0}
                max={snapshot.standbyMax}
                busy={busy}
                onClick={() => onStandby(mode)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Na lista de espera: o jogador não está na fila, só vê a fila do modo e a ordem da espera. O primeiro pode entrar.
function StandbyView({ snapshot, busy, onJoin, onLeave }: { snapshot: QueueSnapshot; busy: boolean; onJoin: () => void; onLeave: () => void }) {
  const mode = snapshot.mode ?? 'vote'
  const standby = snapshot.standby
  if (!standby) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-display text-2xl text-gold-50">
            Na lista de espera
            <span className="rounded bg-gold-200/15 px-2 py-0.5 font-sans text-xs font-semibold text-gold-200">{queueModes[mode].name}</span>
          </p>
          <p className="mt-1 text-sm text-ash">
            {standby.canJoin
              ? 'Você é o primeiro da espera: entre na fila quando quiser.'
              : `Você é o ${standby.position}º da espera. Quando chegar a sua vez, o botão de entrar na fila é liberado.`}
          </p>
        </div>
        <p className="text-right">
          <span className="block font-cond text-4xl font-bold leading-none tabular-nums text-gold-50">
            {snapshot.size}
            <span className="text-xl text-ash">/{snapshot.required}</span>
          </span>
          <span className="text-xs text-ash">na fila agora</span>
        </p>
      </div>

      <QueueSlots snapshot={snapshot} />

      {/* A ordem da espera */}
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ash">
          Lista de espera ({standby.size}/{snapshot.standbyMax})
        </p>
        <ol className="flex flex-wrap gap-1.5">
          {standby.players.map((p, i) => (
            <li
              key={p.userId}
              className={`flex items-center gap-1.5 rounded-md border py-1 pl-1.5 pr-2.5 text-sm ${
                p.isYou ? 'border-gold-200/40 bg-gold-200/10' : 'border-rim bg-panel'
              }`}
            >
              <span className="font-cond text-sm font-bold tabular-nums text-ash">{i + 1}º</span>
              <SummonerIcon iconId={p.iconId} size="xs" ring={p.isYou ? 'gold' : 'dim'} />
              <span className="font-semibold text-gold-50">{splitRiotId(p.riotId)[0]}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HexButton onClick={onJoin} disabled={busy || !standby.canJoin}>
          Entrar na fila
        </HexButton>
        <HexButton variant="secondary" onClick={onLeave} disabled={busy}>
          Sair da espera
        </HexButton>
        {!standby.canJoin && <span className="text-sm text-ash">Só o primeiro da espera pode entrar na fila.</span>}
      </div>
    </div>
  )
}

export default function QueuePanel() {
  const { snapshot, connected, busy, error, join, joinStandby, promote, leave } = useQueue()

  return (
    <div className="space-y-4">
      {!snapshot && <p className="text-ash">Conectando à fila...</p>}

      {snapshot?.status === 'idle' && <ModePicker snapshot={snapshot} busy={busy} onJoin={join} onStandby={joinStandby} />}

      {snapshot?.status === 'standby' && <StandbyView snapshot={snapshot} busy={busy} onJoin={promote} onLeave={leave} />}

      {snapshot?.status === 'queued' && (
        <QueuedView snapshot={snapshot} busy={busy} onLeave={leave} onSwitch={join} />
      )}

      {snapshot?.status === 'ready_check' && (
        <p className="flex items-center gap-2 font-display text-xl text-gold-50">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-gold-200" />
          Partida encontrada: aceite no aviso para entrar no lobby.
        </p>
      )}

      {/* Já está em um lobby: o Layout leva para lá quando a fila enche; isso é para quem voltou à aba Jogar. */}
      {snapshot?.status === 'matched' && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <HexLink to="/lobby" size="lg">
            Voltar ao lobby
          </HexLink>
          <p className="text-sm text-gold-50/80">Sua partida está esperando por você.</p>
        </div>
      )}

      {error && <Notice>{error}</Notice>}
      {snapshot && !connected && <Notice tone="warning">Conexão perdida. Reconectando...</Notice>}
    </div>
  )
}
