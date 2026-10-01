import { useEffect, useState } from 'react'
import { useQueue, type QueueSnapshot } from '../context/QueueContext'
import { formatDuration, splitRiotId } from '../lib/teams'
import HexButton, { HexLink } from './ui/HexButton'
import Notice from './ui/Notice'
import SummonerIcon from './ui/SummonerIcon'

// As 10 vagas da partida: ícone de quem já entrou, círculo vazio para quem falta.
function QueueSlots({ snapshot }: { snapshot: QueueSnapshot }) {
  const slots = Array.from({ length: snapshot.required }, (_, i) => snapshot.players[i] ?? null)

  return (
    <ul className="grid grid-cols-5 gap-x-2 gap-y-4 sm:gap-x-4" aria-label="Jogadores na fila">
      {slots.map((player, i) =>
        player ? (
          <li key={player.riotId} className="flex min-w-0 flex-col items-center gap-1.5" title={player.riotId}>
            <SummonerIcon iconId={player.iconId} size="md" ring={player.isYou ? 'gold' : 'cyan'} glow={player.isYou} />
            <span className={`w-full truncate text-center text-xs ${player.isYou ? 'font-semibold text-gold-50' : 'text-ash'}`}>
              {splitRiotId(player.riotId)[0]}
            </span>
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

function QueuedView({ snapshot, busy, onLeave }: { snapshot: QueueSnapshot; busy: boolean; onLeave: () => void }) {
  const elapsed = useElapsedSeconds()

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

      <HexButton variant="secondary" onClick={onLeave} disabled={busy}>
        Sair da fila
      </HexButton>
    </div>
  )
}

export default function QueuePanel() {
  const { snapshot, connected, busy, error, join, leave } = useQueue()

  return (
    <div className="space-y-4">
      {!snapshot && <p className="text-ash">Conectando à fila...</p>}

      {snapshot?.status === 'idle' && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <HexButton size="lg" onClick={join} disabled={busy}>
            Encontrar partida
          </HexButton>
          <p className="flex items-center gap-2 text-sm text-gold-50/80">
            <span className="h-2 w-2 rounded-full bg-hex-300" />
            {snapshot.size === 1 ? '1 jogador na fila agora' : `${snapshot.size} jogadores na fila agora`}
          </p>
        </div>
      )}

      {snapshot?.status === 'queued' && <QueuedView snapshot={snapshot} busy={busy} onLeave={leave} />}

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
