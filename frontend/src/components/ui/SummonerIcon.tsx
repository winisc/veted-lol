import type { ReactNode } from 'react'
import { iconUrl } from '../../lib/ddragon'

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type IconRing = 'gold' | 'blue' | 'red' | 'cyan' | 'bagre' | 'dim'

const sizes: Record<IconSize, string> = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
  '2xl': 'h-28 w-28',
}

// Anel fino e sólido indicando o contexto (você/destaque, lado do time, ao vivo).
const rings: Record<IconRing, string> = {
  gold: 'bg-gold-200',
  blue: 'bg-team-blue',
  red: 'bg-team-red',
  cyan: 'bg-hex-300',
  bagre: 'bg-bagre',
  dim: 'bg-rim',
}

interface Props {
  iconId: number
  size?: IconSize
  ring?: IconRing
  glow?: boolean // mantido por compatibilidade; o visual atual não usa brilho
  badge?: ReactNode // fica centralizado embaixo do ícone (ex.: coroa do capitão)
  className?: string
}

export default function SummonerIcon({ iconId, size = 'md', ring = 'dim', badge, className = '' }: Props) {
  const thick = size === 'xl' || size === '2xl' ? 'p-[3px]' : 'p-[2px]'

  return (
    <span className={`relative inline-block shrink-0 rounded-full ${thick} ${rings[ring]} ${sizes[size]} ${className}`}>
      <img
        src={iconUrl(iconId)}
        alt=""
        loading="lazy"
        className="h-full w-full rounded-full bg-panel object-cover"
        onError={(e) => {
          e.currentTarget.style.visibility = 'hidden'
        }}
      />
      {badge && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2">{badge}</span>}
    </span>
  )
}
