import { useEffect, useState } from 'react'

interface Props {
  endsAt: number | null
  durationMs: number
  skew: number
  label?: string
}

function useSecondsLeft(endsAt: number | null, skew: number) {
  const calc = () => (endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - (Date.now() + skew)) / 1000)))
  const [seconds, setSeconds] = useState(calc)

  useEffect(() => {
    setSeconds(calc())
    const timer = setInterval(() => setSeconds(calc()), 250)
    return () => clearInterval(timer)
  }, [endsAt, skew])

  return seconds
}

// Contagem regressiva da fase em uma linha (número + barra), sincronizada com o relógio do servidor.
export default function PhaseTimer({ endsAt, durationMs, skew, label }: Props) {
  const seconds = useSecondsLeft(endsAt, skew)
  const total = Math.max(1, durationMs / 1000)
  const urgent = seconds <= 5

  return (
    <div className="mx-auto flex w-full max-w-xl items-center gap-4" role="timer" aria-live="off">
      <span
        className={`w-14 text-right font-cond text-4xl font-bold leading-none tabular-nums ${urgent ? 'text-team-red' : 'text-gold-50'}`}
      >
        {seconds}
      </span>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-rim">
          <div
            className={`h-full transition-all duration-300 ${
              urgent ? 'bg-team-red' : 'bg-gold-200'
            }`}
            style={{ width: `${Math.min(100, (seconds / total) * 100)}%` }}
          />
        </div>
        {label && <p className="mt-1.5 truncate text-sm text-ash">{label}</p>}
      </div>
    </div>
  )
}
