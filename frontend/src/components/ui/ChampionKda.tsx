import type { PlayerGameStats } from '../../hooks/useLobby'
import { useChampions } from '../../lib/champions'

// Abrevia números grandes: 12345 -> "12,3k".
export const compactNumber = (n: number) =>
  n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : String(n)

// Campeão e KDA de um jogador na partida (do print do placar). `detail` mostra também farm, ouro e dano.
export default function ChampionKda({
  stats,
  detail = false,
}: {
  stats: Omit<PlayerGameStats, 'userId'>
  detail?: boolean
}) {
  const { nameOf, iconOf } = useChampions()
  const extra = [
    stats.cs !== null && `${stats.cs} CS`,
    stats.gold !== null && `${compactNumber(stats.gold)} ouro`,
    stats.damage !== null && `${compactNumber(stats.damage)} dano`,
  ].filter(Boolean)
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" title={`${nameOf(stats.champion)} · ${stats.kills}/${stats.deaths}/${stats.assists}`}>
      <img src={iconOf(stats.champion)} alt={nameOf(stats.champion)} className="h-6 w-6 rounded" />
      <span className="flex flex-col items-start leading-tight">
        <span className="font-cond text-sm font-bold tabular-nums text-gold-50">
          {stats.kills}/<span className="text-team-red">{stats.deaths}</span>/{stats.assists}
        </span>
        {detail && extra.length > 0 && <span className="text-[11px] text-ash">{extra.join(' · ')}</span>}
      </span>
    </span>
  )
}
