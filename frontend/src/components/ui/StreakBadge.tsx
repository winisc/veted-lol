// Sequência atual: 🧊 (o "gelin") com 3+ vitórias seguidas, 🐀 de ponta-cabeça (rato morto) com 3+ derrotas seguidas. Abaixo disso não mostra nada.
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
        hot ? 'text-sky-300' : 'text-team-red'
      } ${className}`}
    >
      {hot ? (
        <span className="text-[13px]">🧊</span>
      ) : (
        // Não existe emoji de rato morto: o rato virado de barriga para cima.
        <span className="inline-block rotate-180 text-[13px]">🐀</span>
      )}
      {n}
    </span>
  )
}
