import { formatDate } from '../lib/format'
import { zones, type Zone } from '../lib/zones'
import Panel from './ui/Panel'

export interface SeasonResult {
  id: number
  current: boolean
  legacy: boolean // a tabela antiga, de antes das seasons semanais
  startsAt: string
  endsAt: string
  position: number | null // null: não jogou nessa season
  zone: Zone | null
  points: number | null
  games: number | null
  rankedPlayers: number
}

const seasonName = (s: SeasonResult) => `Season ${s.id}`

// Posição do jogador em cada season: a atual (em andamento) e as encerradas, com a classificação final guardada.
export default function ProfileSeasons({ seasons }: { seasons: SeasonResult[] }) {
  return (
    <Panel title="Seasons" bodyClassName="p-3">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {seasons.map((s) => {
          const zone = s.zone ? zones[s.zone] : null
          return (
            <li key={s.id} className="flex items-center gap-3 rounded-md bg-panel px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-gold-50">
                  {seasonName(s)}
                  {s.current && <span className="rounded bg-hex-300/15 px-1.5 py-0.5 text-[11px] text-hex-300">em andamento</span>}
                </p>
                <p className="truncate text-xs text-ash">
                  {s.legacy ? `até ${formatDate(s.endsAt)}` : `${formatDate(s.startsAt)} a ${formatDate(s.endsAt)}`}
                </p>
              </div>

              {s.position !== null && zone ? (
                <div className="shrink-0 text-right">
                  <p className={`font-cond text-2xl font-bold leading-none tabular-nums ${zone.text}`}>
                    #{s.position}
                    <span className="ml-1 font-sans text-xs font-normal text-ash">de {s.rankedPlayers}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ash">
                    {s.points} pts · {s.games} {s.games === 1 ? 'jogo' : 'jogos'}
                  </p>
                </div>
              ) : (
                <p className="shrink-0 text-xs text-ash-dim">{s.current ? 'Sem jogos ainda' : 'Não jogou'}</p>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
