import type { ReactNode } from 'react'
import { formatPercent } from '../lib/format'
import { splitRiotId } from '../lib/teams'
import Panel from './ui/Panel'
import PlayerLink from './ui/PlayerLink'
import SummonerIcon from './ui/SummonerIcon'

export interface Rival {
  userId: number
  riotId: string
  iconId: number
  wins: number
  losses: number
}

export interface ProfileExtraData {
  captain: { games: number; wins: number; winRate: number | null }
  streaks: { current: { type: 'win' | 'loss' | null; count: number }; bestWin: number; worstLoss: number }
  rivals: { victim: Rival | null; nemesis: Rival | null }
  duos?: { best: Rival | null; worst: Rival | null } // ausente em servidores antigos
}

function Card({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-rim bg-panel px-3 py-2.5">
      <p className="text-xs text-ash">{label}</p>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-0.5 truncate text-xs text-ash">{hint}</p>}
    </div>
  )
}

function RivalCard({
  label,
  rival,
  tone,
  empty,
  suffix = 'contra',
}: {
  label: string
  rival: Rival | null
  tone: string
  empty: string
  suffix?: string
}) {
  if (!rival) {
    return (
      <Card label={label}>
        <p className="text-sm text-ash-dim">{empty}</p>
      </Card>
    )
  }
  const [name] = splitRiotId(rival.riotId)
  return (
    <Card label={label} hint={`${rival.wins}V ${rival.losses}D ${suffix}`}>
      <div className="flex items-center gap-2">
        <SummonerIcon iconId={rival.iconId} size="xs" ring="dim" />
        <PlayerLink userId={rival.userId} className={`truncate font-display text-lg font-semibold leading-tight ${tone}`}>
          {name}
        </PlayerLink>
      </div>
    </Card>
  )
}

// Mini-gráfico de linha. `values` são os pontos da tabela depois de cada partida (do mais antigo ao mais novo).
function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  const W = 100
  const H = 32
  const PAD = 3
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2)
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const color = up ? 'var(--color-hex-300)' : 'var(--color-team-red)'
  const last = values.length - 1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-8 w-full overflow-visible" aria-hidden="true">
      <polyline points={`0,${H} ${line} ${W},${H}`} fill={color} fillOpacity="0.12" stroke="none" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last)} cy={y(values[last])} r="2.2" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// Estatísticas a mais do perfil: como capitão, sequências e adversários mais marcantes.
export default function ProfileExtra({ extra, evolution }: { extra: ProfileExtraData; evolution?: number[] }) {
  const { captain, streaks, rivals, duos } = extra
  const { current } = streaks
  const delta = evolution && evolution.length >= 3 ? evolution[evolution.length - 1] - evolution[0] : null

  return (
    <Panel title="Mais estatísticas" bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card
          label="Como capitão"
          hint={captain.games === 0 ? 'Nunca foi capitão' : `${captain.wins} vitória${captain.wins === 1 ? '' : 's'} em ${captain.games}`}
        >
          <p className="font-cond text-3xl font-bold leading-none tabular-nums text-gold-50">{formatPercent(captain.winRate)}</p>
        </Card>

        <Card
          label="Sequência atual"
          hint={current.type === null ? 'Sem partidas' : current.type === 'win' ? 'vitórias seguidas' : 'derrotas seguidas'}
        >
          <p
            className={`font-cond text-3xl font-bold leading-none tabular-nums ${
              current.type === 'win' ? 'text-hex-300' : current.type === 'loss' ? 'text-team-red' : 'text-ash-dim'
            }`}
          >
            {current.count}
          </p>
        </Card>

        <Card label="Maiores sequências" hint="vitórias / derrotas">
          <p className="font-cond text-3xl font-bold leading-none tabular-nums">
            <span className="text-hex-300">{streaks.bestWin}</span>
            <span className="mx-1.5 text-ash-dim">/</span>
            <span className="text-team-red">{streaks.worstLoss}</span>
          </p>
        </Card>

        <Card
          label="Evolução"
          hint={delta === null || !evolution ? 'Precisa de 2 partidas' : `nas últimas ${evolution.length - 1} partidas`}
        >
          {delta !== null && evolution ? (
            <div className="flex items-end gap-2">
              <p
                className={`font-cond text-3xl font-bold leading-none tabular-nums ${delta >= 0 ? 'text-hex-300' : 'text-team-red'}`}
              >
                {delta > 0 ? '+' : ''}
                {delta}
              </p>
              <div className="min-w-0 flex-1">
                <Sparkline values={evolution} up={delta >= 0} />
              </div>
            </div>
          ) : (
            <p className="font-cond text-3xl font-bold leading-none text-ash-dim">—</p>
          )}
        </Card>
      </div>

      {/* Com quem e contra quem: duos (mesmo time) e adversários (times opostos) */}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {duos && (
          <>
            <RivalCard label="Melhor duo" rival={duos.best} tone="text-hex-300" empty="Ninguém ainda" suffix="juntos" />
            <RivalCard label="Pior duo" rival={duos.worst} tone="text-team-red" empty="Ninguém ainda" suffix="juntos" />
          </>
        )}
        <RivalCard label="Freguês" rival={rivals.victim} tone="text-hex-300" empty="Ninguém ainda" />
        <RivalCard label="Carrasco" rival={rivals.nemesis} tone="text-team-red" empty="Ninguém ainda" />
      </div>
      <p className="mt-2 px-1 text-xs text-ash-dim">
        Duo é quem joga no mesmo time que você; freguês e carrasco, no time contrário. Precisam de pelo menos 2 partidas e
        saldo de um lado só.
      </p>
    </Panel>
  )
}
