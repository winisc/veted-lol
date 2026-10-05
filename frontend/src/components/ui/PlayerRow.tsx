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
  fullName?: boolean // linha de altura fixa que dá prioridade ao nick inteiro (nunca quebra de linha)
  hideTag?: boolean // com fullName: esconde a #TAG para sobrar espaço ao nick
  stacked?: boolean // cartão de duas linhas e altura fixa: nick (e etiquetas) em cima; #TAG e o canto direito embaixo
  maxNameChars?: number // corta o nick com "..." depois desse tanto de letras (o nick inteiro fica no tooltip)
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
  hideTag,
  stacked,
  maxNameChars,
  disabled,
  className = '',
}: Props) {
  const [fullNick, tag] = splitRiotId(riotId)
  const name = maxNameChars && fullNick.length > maxNameChars ? `${fullNick.slice(0, maxNameChars).trimEnd()}…` : fullNick
  const classes = `flex w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left ${
    highlight ? 'border-gold-200/40 bg-gold-200/[0.06]' : 'border-transparent bg-panel'
  } ${className}`

  const body = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <SummonerIcon iconId={iconId} size={size} ring={ring} />
      {stacked ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate font-semibold leading-5 text-gold-50">{name}</span>
            {badges && <span className="flex shrink-0 items-center gap-1">{badges}</span>}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-xs leading-5 text-ash">#{tag}</span>
            {right && <span className="shrink-0">{right}</span>}
          </span>
        </div>
      ) : (
      <div className={`flex min-w-0 flex-1 items-center gap-x-2 ${fullName ? '' : 'flex-wrap gap-y-0.5'}`}>
        <span className="min-w-0 truncate font-semibold text-gold-50">{name}</span>
        {!(fullName && hideTag) && (
          <span className={`text-xs text-ash ${fullName ? 'shrink-0' : 'hidden xl:inline'}`}>#{tag}</span>
        )}
        {fullName ? badges && <span className="flex shrink-0 items-center gap-1">{badges}</span> : badges}
      </div>
      )}
      {right && !stacked && <div className="shrink-0">{right}</div>}
    </>
  )

  if (to) {
    return (
      <Link to={to} title={riotId} className={`${classes} transition-colors hover:border-gold-200/60 hover:bg-rim`}>
        {body}
      </Link>
    )
  }

  if (!onClick) return <div className={classes} title={riotId}>{body}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={riotId}
      className={`${classes} transition-colors hover:border-gold-200/60 hover:bg-rim disabled:opacity-60`}
    >
      {body}
    </button>
  )
}
