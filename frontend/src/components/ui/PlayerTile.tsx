import type { ReactNode } from 'react'
import { splitRiotId } from '../../lib/teams'
import SummonerIcon, { type IconRing } from './SummonerIcon'

interface Props {
  riotId: string
  iconId: number
  ring?: IconRing
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
  disabled?: boolean
  footer?: ReactNode // linha de etiquetas abaixo do nome
  corner?: ReactNode // canto superior direito (ex.: "já votou")
  iconBadge?: ReactNode
}

// Cartão vertical e compacto de jogador (votação, MVP). Clicável quando recebe onClick.
export default function PlayerTile({
  riotId,
  iconId,
  ring = 'dim',
  selected,
  dimmed,
  onClick,
  disabled,
  footer,
  corner,
  iconBadge,
}: Props) {
  const [name, tag] = splitRiotId(riotId)
  const className = `relative flex w-full flex-col items-center gap-1 rounded-lg border px-2 pb-2 pt-3 text-center transition-colors ${
    selected ? 'border-gold-200 bg-gold-200/[0.08]' : 'border-rim bg-panel'
  } ${dimmed ? 'opacity-40' : ''}`

  const body = (
    <>
      <SummonerIcon iconId={iconId} size="md" ring={selected ? 'gold' : ring} badge={iconBadge} />
      <span className="mt-0.5 w-full truncate font-semibold leading-tight text-gold-50">{name}</span>
      <span className="w-full truncate text-xs leading-tight text-ash">#{tag}</span>
      <span className="flex min-h-5 flex-wrap items-center justify-center gap-1.5">{footer}</span>
      {corner && <span className="absolute right-1.5 top-1.5">{corner}</span>}
    </>
  )

  if (!onClick) return <div className={className}>{body}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`${className} ${selected ? '' : 'hover:border-ash-dim hover:bg-rim'}`}
    >
      {body}
    </button>
  )
}
