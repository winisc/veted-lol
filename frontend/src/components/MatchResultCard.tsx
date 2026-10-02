import { useEffect, useState } from 'react'
import type { MatchOutcome, Side } from '../hooks/useLobby'
import { queueModes, type QueueMode } from '../lib/modes'
import { formatDuration, sideStyle, splitRiotId } from '../lib/teams'
import { CrownIcon, FishIcon, StarIcon } from './ui/icons'
import SummonerIcon from './ui/SummonerIcon'

export interface RecentResult {
  matchId: string
  mode: QueueMode
  gameNumber: number
  outcome: MatchOutcome
  startedAt: number | null
  endedAt: number
  finishedAt: number
  expiresAt: number
  mvpId: number | null
  bagreId: number | null
  teams: Record<Side, { id: number; riotId: string; iconId: number; isCaptain: boolean }[]>
}

// Some da tela quando o tempo do resumo acaba, sem esperar a próxima atualização da lista.
export function useVisibleResults(results: RecentResult[] | undefined, skew: number) {
  const [now, setNow] = useState(() => Date.now() + skew)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + skew), 250)
    return () => clearInterval(timer)
  }, [skew])
  return { now, visible: (results ?? []).filter((r) => r.expiresAt > now) }
}

// Resumo final de uma partida que acabou de terminar: vencedor, MVP e bagre.
export default function MatchResultCard({ result, now }: { result: RecentResult; now: number }) {
  const remake = result.outcome === 'remake'
  const players = [...result.teams.blue, ...result.teams.red]
  const mvp = players.find((p) => p.id === result.mvpId)
  const bagre = players.find((p) => p.id === result.bagreId)
  const duration = result.startedAt ? (result.endedAt - result.startedAt) / 1000 : 0
  const total = result.expiresAt - result.finishedAt
  const left = Math.max(0, Math.min(100, ((result.expiresAt - now) / total) * 100))

  return (
    <li className="animate-phase-in overflow-hidden rounded-lg border border-gold-200/40 bg-gold-200/[0.04]">
      <div className="p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-gold-200 px-2 py-0.5 text-xs font-semibold text-void">Fim de jogo</span>
          <span className="rounded bg-gold-200/15 px-2 py-0.5 text-xs font-semibold text-gold-200">
            {queueModes[result.mode ?? 'vote'].short}
          </span>
          {result.gameNumber > 1 && <span className="text-xs text-ash">Partida {result.gameNumber}</span>}
          <span className="ml-auto font-cond text-base font-semibold tabular-nums text-ash">{formatDuration(duration)}</span>
        </div>

        <p
          className={`font-display text-xl leading-tight ${
            remake ? 'text-gold-50' : sideStyle[result.outcome as Side].text
          }`}
        >
          {remake ? 'Remake' : `Vitória do ${sideStyle[result.outcome as Side].name}`}
        </p>

        {!remake && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                [mvp, 'MVP', <StarIcon key="s" className="h-3.5 w-3.5" />, 'text-gold-200', 'gold'],
                [bagre, 'Bagre', <FishIcon key="f" className="h-3.5 w-3.5" />, 'text-bagre', 'bagre'],
              ] as const
            ).map(([player, label, icon, color, ring]) => (
              <div key={label} className="flex min-w-0 items-center gap-2 rounded-md bg-panel px-2 py-1.5">
                {player ? (
                  <>
                    <SummonerIcon iconId={player.iconId} size="sm" ring={ring} />
                    <div className="min-w-0">
                      <p className={`flex items-center gap-1 text-xs font-semibold ${color}`}>
                        {icon} {label}
                      </p>
                      <p className="flex items-center gap-1 truncate text-sm font-semibold text-gold-50">
                        {splitRiotId(player.riotId)[0]}
                        {player.isCaptain && <CrownIcon className="h-3 w-3 shrink-0 text-gold-200" />}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className={`flex items-center gap-1 text-xs ${color}`}>
                    {icon} Sem {label.toLowerCase()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Tempo restante do resumo na tela. */}
      <div className="h-0.5 bg-rim">
        <div className="h-full bg-gold-200 transition-[width] duration-300 ease-linear" style={{ width: `${left}%` }} />
      </div>
    </li>
  )
}
