import { useElapsed } from '../hooks/useElapsed'
import { useApi } from '../hooks/useApi'
import type { LobbyPhase, Side } from '../hooks/useLobby'
import { queueModes, type QueueMode } from '../lib/modes'
import { formatDuration, sideStyle, splitRiotId } from '../lib/teams'
import MatchResultCard, { useVisibleResults, type RecentResult } from './MatchResultCard'
import { CrownIcon } from './ui/icons'
import PlayerLink from './ui/PlayerLink'
import Panel from './ui/Panel'
import SummonerIcon from './ui/SummonerIcon'

interface LivePlayer {
  id: number
  riotId: string
  iconId: number
  isCaptain: boolean
}

interface LiveMatch {
  id: string
  mode: QueueMode
  phase: LobbyPhase
  gameNumber: number
  startedAt: number | null
  endedAt: number | null
  teams: Record<Side, LivePlayer[]>
}

const REFRESH_MS = 5000

const phaseLabel: Partial<Record<LobbyPhase, string>> = {
  playing: 'Em jogo',
  result: 'Votando o vencedor',
  mvp: 'Votando o MVP',
  bagre: 'Votando o bagre',
}

function MatchCard({ match, skew }: { match: LiveMatch; skew: number }) {
  const seconds = useElapsed(match.startedAt, skew, match.endedAt)
  const playing = match.phase === 'playing'

  return (
    <li className="rounded-lg border border-rim bg-panel/50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ${
            playing ? 'bg-hex-300/15 text-hex-300' : 'bg-rim text-gold-50'
          }`}
        >
          {playing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hex-300" aria-hidden="true" />}
          {phaseLabel[match.phase] ?? 'Em andamento'}
        </span>
        <span className="rounded bg-gold-200/15 px-2 py-0.5 text-xs font-semibold text-gold-200">
          {queueModes[match.mode ?? 'vote'].short}
        </span>
        {match.gameNumber > 1 && <span className="text-xs text-ash">Partida {match.gameNumber}</span>}
        <span className="ml-auto font-cond text-base font-semibold tabular-nums text-gold-50">{formatDuration(seconds)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['blue', 'red'] as Side[]).map((side) => (
          <ul key={side} className="space-y-1">
            {match.teams[side].map((p) => (
              <li key={p.id} className="flex min-w-0 items-center gap-1.5">
                <SummonerIcon iconId={p.iconId} size="xs" ring={sideStyle[side].ring} />
                <PlayerLink userId={p.id} className="truncate text-sm text-gold-50">
                  {splitRiotId(p.riotId)[0]}
                </PlayerLink>
                {p.isCaptain && <CrownIcon className="h-3 w-3 shrink-0 text-gold-200" />}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </li>
  )
}

// Partidas em andamento agora, para todo mundo acompanhar da tela inicial (só leitura).
export default function LiveMatches() {
  const { data } = useApi<{ matches: LiveMatch[]; recent?: RecentResult[]; now: number }>('/lobby/live', REFRESH_MS)
  // Servidor sem esse recurso (versão antiga) ou fora do ar: o card simplesmente não aparece.
  const skew = data ? data.now - Date.now() : 0
  const { now, visible: recent } = useVisibleResults(data?.recent, skew)
  if (!data) return null
  const count = data.matches.length + recent.length

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Partidas ao vivo <span className="font-cond text-base text-ash">({data.matches.length})</span>
        </span>
      }
      bodyClassName="p-3"
    >
      {count === 0 ? (
        <p className="px-2 py-3 text-center text-sm text-ash">Nenhuma partida em andamento agora.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {recent.map((result) => (
            <MatchResultCard key={result.matchId} result={result} now={now} />
          ))}
          {data.matches.map((match) => (
            <MatchCard key={match.id} match={match} skew={skew} />
          ))}
        </ul>
      )}
    </Panel>
  )
}
