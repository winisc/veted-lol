import { formatDate } from '../lib/format'
import { zones, type Zone } from '../lib/zones'

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

// Posição do jogador em cada season, em fichas pequenas (cabem no banner do perfil): a atual em andamento e as
// encerradas com a classificação final guardada. O tooltip mostra o período e os detalhes.
export default function ProfileSeasons({ seasons }: { seasons: SeasonResult[] }) {
  return (
    <ul className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start" aria-label="Seasons">
      {seasons.map((s) => {
        const zone = s.zone ? zones[s.zone] : null
        const period = s.legacy ? `até ${formatDate(s.endsAt)}` : `${formatDate(s.startsAt)} a ${formatDate(s.endsAt)}`
        const detail =
          s.position !== null
            ? `#${s.position} de ${s.rankedPlayers} · ${s.points} pts · ${s.games} ${s.games === 1 ? 'jogo' : 'jogos'}`
            : s.current
              ? 'sem jogos ainda'
              : 'não jogou'

        return (
          <li
            key={s.id}
            title={`Season ${s.id}${s.current ? ' (em andamento)' : ''} · ${period} · ${detail}`}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
              s.current ? 'border-hex-300/40 bg-hex-300/10' : 'border-rim bg-abyss/70'
            }`}
          >
            <span className="font-semibold text-gold-50">Season {s.id}</span>
            {s.position !== null && zone ? (
              <>
                <span className={`font-cond text-sm font-bold tabular-nums ${zone.text}`}>#{s.position}</span>
                <span className="text-ash">{s.points} pts</span>
              </>
            ) : (
              <span className={s.current ? 'text-hex-300' : 'text-ash-dim'}>{s.current ? 'em andamento' : 'não jogou'}</span>
            )}
            {s.current && s.position !== null && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hex-300" aria-label="em andamento" />}
          </li>
        )
      })}
    </ul>
  )
}
