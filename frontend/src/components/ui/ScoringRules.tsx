import type { ReactNode } from 'react'
import { signed } from '../../lib/format'
import { FishIcon, StarIcon } from './icons'

interface Scoring {
  win: number
  loss: number
  mvp: number
  bagre?: number // ausente em servidores antigos
}

function Rule({ value, label, classes, icon }: { value: string; label: string; classes: string; icon?: ReactNode }) {
  return (
    <li className={`flex min-w-24 flex-col items-center rounded-lg border border-rim bg-abyss/80 px-3 py-2 ${classes}`}>
      <span className="flex items-center gap-1 font-cond text-2xl font-bold leading-none tabular-nums">
        {icon}
        {value}
      </span>
      <span className="mt-1 text-xs text-ash">{label}</span>
    </li>
  )
}

// Regras de pontuação da tabela, em fichas (uma por resultado).
export default function ScoringRules({ scoring, className = '' }: { scoring: Scoring; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Como os pontos são calculados">
      <Rule value={signed(scoring.win)} label="por vitória" classes="text-hex-300" />
      <Rule value={signed(scoring.loss)} label="por derrota" classes="text-team-red" />
      <Rule
        value={signed(scoring.mvp)}
        label="bônus de MVP"
        classes="text-gold-200"
        icon={<StarIcon className="h-4 w-4" />}
      />
      {scoring.bagre !== undefined && (
        <Rule
          value={signed(scoring.bagre)}
          label="para o bagre"
          classes="text-bagre"
          icon={<FishIcon className="h-4 w-4" />}
        />
      )}
      <Rule value="0" label="remake não conta" classes="text-gold-50" />
    </ul>
  )
}
