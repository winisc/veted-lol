import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { splitRiotId } from '../../lib/teams'
import SummonerIcon, { type IconRing, type IconSize } from './SummonerIcon'

interface Props {
  riotId: string
  iconId: number
  ring?: IconRing
  size?: IconSize
  highlight?: boolean
  leading?: ReactNode // antes do ícone (ex.: posição na tabela)
  badges?: ReactNode // na mesma linha do nome
  right?: ReactNode // canto direito
  onClick?: () => void // vira botão (ex.: pick no draft)
  to?: string // vira link (ex.: perfil do jogador)
  fullName?: boolean // mostra o nick inteiro (quebra de linha em vez de cortar com "...")
  disabled?: boolean
  className?: string
}

// Linha horizontal e compacta de jogador (times, listas, picks).
export default function PlayerRow({
  riotId,
  iconId,
  ring = 'dim',
  size = 'sm',
  highlight,
  leading,
  badges,
  right,
  onClick,
  to,
  fullName,
  disabled,
  className = '',
}: Props) {
  const [name, tag] = splitRiotId(riotId)
  const classes = `flex w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left ${
    highlight ? 'border-gold-200/40 bg-gold-200/[0.06]' : 'border-transparent bg-panel'
  } ${className}`

  const body = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <SummonerIcon iconId={iconId} size={size} ring={ring} />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className={`font-semibold text-gold-50 ${fullName ? 'min-w-0 break-words' : 'truncate'}`}>{name}</span>
        <span className={`text-xs text-ash ${fullName ? '' : 'hidden xl:inline'}`}>#{tag}</span>
        {badges}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={`${classes} transition-colors hover:border-gold-200/60 hover:bg-rim`}>
        {body}
      </Link>
    )
  }

  if (!onClick) return <div className={classes}>{body}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${classes} transition-colors hover:border-gold-200/60 hover:bg-rim disabled:opacity-60`}
    >
      {body}
    </button>
  )
}
