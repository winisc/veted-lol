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

function RivalCard({ label, rival, tone, empty }: { label: string; rival: Rival | null; tone: string; empty: string }) {
  if (!rival) {
    return (
      <Card label={label}>
        <p className="text-sm text-ash-dim">{empty}</p>
      </Card>
    )
  }
  const [name] = splitRiotId(rival.riotId)
  return (
    <Card label={label} hint={`${rival.wins}V ${rival.losses}D contra`}>
      <div className="flex items-center gap-2">
        <SummonerIcon iconId={rival.iconId} size="xs" ring="dim" />
        <PlayerLink userId={rival.userId} className={`truncate font-display text-lg font-semibold leading-tight ${tone}`}>
          {name}
        </PlayerLink>
      </div>
    </Card>
  )
}

// Estatísticas a mais do perfil: como capitão, sequências e adversários mais marcantes.
export default function ProfileExtra({ extra }: { extra: ProfileExtraData }) {
  const { captain, streaks, rivals } = extra
  const { current } = streaks

  return (
    <Panel title="Mais estatísticas" bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
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

        <RivalCard label="Freguês" rival={rivals.victim} tone="text-hex-300" empty="Ninguém ainda" />
        <RivalCard label="Carrasco" rival={rivals.nemesis} tone="text-team-red" empty="Ninguém ainda" />
      </div>
      <p className="mt-2 px-1 text-xs text-ash-dim">
        Freguês e carrasco precisam de pelo menos 2 partidas contra a pessoa e saldo de um lado só.
      </p>
    </Panel>
  )
}
