import { CrownIcon, StarIcon } from './icons'

// Pequenas etiquetas que aparecem junto dos jogadores.

export function YouBadge() {
  return <span className="rounded bg-gold-200/15 px-1.5 py-0.5 text-[11px] font-semibold text-gold-200">Você</span>
}

export function CaptainBadge({ withLabel = true }: { withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-ash" title="Capitão">
      <CrownIcon className="h-3.5 w-3.5 text-gold-200" />
      {withLabel && <span className="text-xs font-medium">Capitão</span>}
    </span>
  )
}

export function MvpBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-gold-200/15 px-1.5 py-0.5 text-[11px] font-semibold text-gold-200">
      <StarIcon className="h-3 w-3" />
      MVP
    </span>
  )
}

// Coroa centralizada sob o ícone de invocador do capitão.
export function CrownMedal() {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full border border-rim bg-abyss text-gold-200">
      <CrownIcon className="h-3 w-3" />
    </span>
  )
}
