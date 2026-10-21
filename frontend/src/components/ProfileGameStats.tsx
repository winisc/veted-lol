import { formatPercent } from '../lib/format'
import { useChampions } from '../lib/champions'
import Panel from './ui/Panel'

export interface ProfileGameStatsData {
  games: number
  kills: number
  deaths: number
  assists: number
  kda: number
  champions: { champion: string; games: number; wins: number; winRate: number | null; kda: number }[]
}

function StatBox({ label, value, tone = 'text-gold-50' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-rim bg-panel px-3 py-2.5">
      <p className="text-xs text-ash">{label}</p>
      <p className={`mt-1 font-cond text-2xl font-bold leading-none tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

const decimal = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

// Partidas com print da pancada (na season): KDA médio e os campeões mais jogados.
export default function ProfileGameStats({ data, seasonId }: { data: ProfileGameStatsData; seasonId?: number }) {
  const { nameOf, iconOf } = useChampions()
  return (
    <Panel
      title={`Em jogo${seasonId === undefined ? '' : ` · Season ${seasonId}`}`}
      action={<span className="text-xs text-ash">{data.games} partida{data.games === 1 ? '' : 's'} com print da pancada</span>}
      bodyClassName="p-3 space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="KDA médio" value={decimal(data.kda)} tone="text-gold-200" />
        <StatBox label="Por partida (A/M/As)" value={`${decimal(data.kills)}/${decimal(data.deaths)}/${decimal(data.assists)}`} />
      </div>

      {data.champions.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ash">Campeões mais jogados</p>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.champions.map((c) => (
              <li key={c.champion} className="flex items-center gap-2.5 rounded-md bg-panel px-2.5 py-1.5">
                <img src={iconOf(c.champion)} alt="" className="h-9 w-9 rounded" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gold-50">{nameOf(c.champion)}</p>
                  <p className="text-xs text-ash">
                    {c.games} partida{c.games === 1 ? '' : 's'} · {formatPercent(c.winRate)} de vitória
                  </p>
                </div>
                <span className="font-cond text-base font-bold tabular-nums text-gold-200" title="KDA">
                  {decimal(c.kda)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
