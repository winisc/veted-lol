// Sequência atual: 🔥 com 3+ vitórias seguidas, 🧊 com 3+ derrotas seguidas. Abaixo disso não mostra nada.
export const STREAK_MIN = 3

export default function StreakBadge({ streak, className = '' }: { streak?: number | null; className?: string }) {
  if (!streak || Math.abs(streak) < STREAK_MIN) return null
  const hot = streak > 0
  const n = Math.abs(streak)
  const label = hot ? `${n} vitórias seguidas` : `${n} derrotas seguidas`
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-0.5 font-cond text-sm font-bold leading-none tabular-nums ${
        hot ? 'text-orange-400' : 'text-sky-300'
      } ${className}`}
    >
      <span className="text-[13px]">{hot ? '🔥' : '🧊'}</span>
      {n}
    </span>
  )
}
