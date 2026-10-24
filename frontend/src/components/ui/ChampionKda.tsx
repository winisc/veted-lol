import type { PlayerGameStats } from '../../hooks/useLobby'
import { useChampions } from '../../lib/champions'

// Campeão e KDA de um jogador na partida (do print da pancada).
export default function ChampionKda({ stats }: { stats: Pick<PlayerGameStats, 'champion' | 'kills' | 'deaths' | 'assists'> }) {
  const { nameOf, iconOf } = useChampions()
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" title={`${nameOf(stats.champion)} · ${stats.kills}/${stats.deaths}/${stats.assists}`}>
      <img src={iconOf(stats.champion)} alt={nameOf(stats.champion)} className="h-6 w-6 rounded" />
      <span className="font-cond text-sm font-bold tabular-nums text-gold-50">
        {stats.kills}/<span className="text-team-red">{stats.deaths}</span>/{stats.assists}
      </span>
    </span>
  )
}

// Só o campeão (escolhido na seleção de campeões), antes de ter o KDA.
export function ChampionIcon({ champion }: { champion: string }) {
  const { nameOf, iconOf } = useChampions()
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" title={nameOf(champion)}>
      <img src={iconOf(champion)} alt={nameOf(champion)} className="h-6 w-6 rounded" />
      <span className="hidden text-xs text-ash sm:inline">{nameOf(champion)}</span>
    </span>
  )
}
