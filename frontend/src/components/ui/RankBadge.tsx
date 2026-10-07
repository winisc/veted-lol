// Posição na tabela da season (quando o lobby abriu), bem compacta: "#3". Top 3 em dourado.
// `overlay`: plaquinha pequena por cima do ícone (como o nível no ícone do LoL).
// Quem ainda não jogou na season não tem posição: não mostra nada.
export default function RankBadge({
  position,
  overlay = false,
  className = '',
}: {
  position?: number | null
  overlay?: boolean
  className?: string
}) {
  if (position == null) return null
  const label = `${position}º na tabela da season`
  const top = position <= 3
  if (overlay) {
    return (
      <span
        title={label}
        aria-label={label}
        className={`block whitespace-nowrap rounded-full border px-1 font-cond text-[10px] font-bold leading-[13px] tabular-nums ${
          top ? 'border-gold-200/70 bg-void text-gold-200' : 'border-rim bg-void text-ash'
        } ${className}`}
      >
        #{position}
      </span>
    )
  }
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center rounded px-1 font-cond text-sm font-bold leading-tight tabular-nums ${
        top ? 'bg-gold-200/15 text-gold-200' : 'bg-rim text-ash'
      } ${className}`}
    >
      #{position}
    </span>
  )
}
