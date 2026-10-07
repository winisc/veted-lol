import { useEffect, useState } from 'react'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// "7 dias", "1 dia", "5h", "42 min": quanto falta para a season acabar. Arredonda para cima, então o primeiro
// dia mostra "7 dias" e o último dia (menos de 24h) passa a mostrar as horas.
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'agora'
  if (ms >= DAY) {
    const days = Math.ceil(ms / DAY)
    return `${days} ${days === 1 ? 'dia' : 'dias'}`
  }
  if (ms >= HOUR) return `${Math.ceil(ms / HOUR)}h`
  return `${Math.max(1, Math.ceil(ms / MINUTE))} min`
}

// Aviso de quando a tabela reseta. `now` é a hora do servidor (para não depender do relógio do aparelho).
export default function SeasonCountdown({ endsAt, now, className = '' }: { endsAt: string; now: number; className?: string }) {
  const [skew] = useState(() => now - Date.now())
  const [, tick] = useState(0)

  // Atualiza o texto de minuto em minuto.
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), MINUTE)
    return () => clearInterval(timer)
  }, [])

  const left = Date.parse(endsAt) - (Date.now() + skew)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded bg-gold-200/15 px-2 py-0.5 text-xs font-semibold text-gold-200 ${className}`}
      title="A tabela é por season semanal: quando acaba, os pontos zeram e a tabela final fica guardada."
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
      {left <= 0 ? 'Reseta agora' : `Reseta em ${formatTimeLeft(left)}`}
    </span>
  )
}
