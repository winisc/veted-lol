import { useEffect } from 'react'
import { useQueue, type DroppedPlayer } from '../context/QueueContext'
import { splitRiotId } from '../lib/teams'
import SummonerIcon from './ui/SummonerIcon'

const VISIBLE_MS = 8000

const reasonLabel: Record<DroppedPlayer['reason'], string> = {
  timeout: 'Não aceitou',
  declined: 'Recusou',
  removed: 'Removido',
}

// Aviso rápido no canto inferior direito: quem não aceitou a partida, para quem aceitou e voltou à fila.
// Aparece e some sozinho; dá para fechar antes.
export default function DroppedToast() {
  const { dropped, clearDropped } = useQueue()

  // A cada aviso novo o relógio recomeça.
  useEffect(() => {
    if (!dropped) return
    const timer = setTimeout(clearDropped, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [dropped, clearDropped])

  if (!dropped) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-phase-in fixed bottom-20 right-4 z-40 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-rim bg-abyss lg:bottom-4"
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-base leading-tight text-gold-50">
            {dropped.length === 1 ? 'Um jogador não aceitou' : `${dropped.length} jogadores não aceitaram`}
          </p>
          <button
            type="button"
            onClick={clearDropped}
            aria-label="Fechar aviso"
            className="-mr-1 -mt-1 px-1.5 py-0.5 text-ash hover:text-gold-50"
          >
            ✕
          </button>
        </div>

        <ul className="mt-2 space-y-1">
          {dropped.map((p) => (
            <li key={p.riotId} className="flex items-center gap-2">
              <SummonerIcon iconId={p.iconId} size="xs" ring="dim" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gold-50">{splitRiotId(p.riotId)[0]}</span>
              <span className="text-xs text-team-red">{reasonLabel[p.reason]}</span>
            </li>
          ))}
        </ul>

        <p className="mt-2 text-xs text-ash">Você voltou para a fila sem perder a vez.</p>
      </div>
      {/* Tempo restante do aviso */}
      <div className="h-0.5 bg-rim">
        <div key={dropped.map((p) => p.riotId).join()} className="dropped-timer h-full origin-left bg-gold-200" />
      </div>
    </div>
  )
}
