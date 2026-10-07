import { eloInfo, type PlayerElo } from '../../lib/elo'
import { EmblemIcon } from './icons'

// Selo de elo do LoL: brasão na cor do elo + nome ("Ouro II") ou, no modo compacto, a sigla ("O2").
// O tooltip mostra os detalhes (PDL, vitórias e derrotas, fila). Sem elo (unranked ou Riot fora do ar): não mostra nada.
export default function EloBadge({ elo, compact = false, className = '' }: { elo?: PlayerElo | null; compact?: boolean; className?: string }) {
  if (!elo) return null
  const info = eloInfo(elo)

  return (
    <span
      title={info.detail}
      aria-label={info.detail}
      className={`inline-flex shrink-0 items-center gap-1 leading-none ${className}`}
      style={{ color: info.color }}
    >
      <EmblemIcon className="h-4 w-4" />
      <span className={compact ? 'font-cond text-sm font-bold' : 'text-xs font-semibold'}>{compact ? info.short : info.full}</span>
    </span>
  )
}
