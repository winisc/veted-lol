import { useApi } from '../hooks/useApi'
import { useElapsed } from '../hooks/useElapsed'
import type { LobbyPhase, Side } from '../hooks/useLobby'
import { queueModes, type QueueMode } from '../lib/modes'
import { formatDuration, sideStyle, splitRiotId } from '../lib/teams'
import { matchPhases, phaseLabel } from './admin/adminShared'
import MatchResultCard, { useVisibleResults, type RecentResult } from './MatchResultCard'
import { CrownIcon } from './ui/icons'
import Panel from './ui/Panel'
import PlayerLink from './ui/PlayerLink'
import SummonerIcon from './ui/SummonerIcon'

interface LivePlayer {
  id: number
  riotId: string
  iconId: number
  team: Side | null // null enquanto o draft não formou os times
  isCaptain: boolean
}

interface LiveMatch {
  id: string
  mode: QueueMode
  phase: LobbyPhase
  gameNumber: number
  startedAt: number | null
  endedAt: number | null
  players?: LivePlayer[]
  teams?: Record<Side, Omit<LivePlayer, 'team'>[]> // formato de servidores antigos (só partidas em andamento)
}

type NormalizedMatch = Omit<LiveMatch, 'players' | 'teams'> & { players: LivePlayer[] }

// Servidor antigo manda só `teams`: monta a lista de jogadores a partir deles.
function normalize(match: LiveMatch): NormalizedMatch {
  const { players, teams, ...rest } = match
  if (players) return { ...rest, players }
  const fromTeams = (['blue', 'red'] as Side[]).flatMap((side) => (teams?.[side] ?? []).map((p) => ({ ...p, team: side })))
  return { ...rest, players: fromTeams }
}

const REFRESH_MS = 5000

function PlayerChip({ player }: { player: LivePlayer }) {
  const ring = player.team ? sideStyle[player.team].ring : 'dim'
  return (
    <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-panel px-2 py-1">
      <SummonerIcon iconId={player.iconId} size="xs" ring={ring} />
      <PlayerLink userId={player.id} className="truncate text-sm font-semibold text-gold-50">
        {splitRiotId(player.riotId)[0]}
      </PlayerLink>
      {player.isCaptain && <CrownIcon className="h-3.5 w-3.5 shrink-0 text-gold-200" />}
    </span>
  )
}

// Um lobby em qualquer etapa (votação, draft, partida...), no mesmo formato da lista de lobbies do admin, só leitura.
function MatchCard({ match, skew }: { match: NormalizedMatch; skew: number }) {
  const inMatch = matchPhases.includes(match.phase)
  const seconds = useElapsed(match.startedAt, skew, match.endedAt)
  const noTeams = match.players.every((p) => p.team === null)
  const withoutTeam = match.players.filter((p) => p.team === null)

  return (
    <li className="rounded-lg border border-rim bg-panel/50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ${
            inMatch ? 'bg-hex-300/15 text-hex-300' : 'bg-rim text-gold-50'
          }`}
        >
          {match.phase === 'playing' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hex-300" aria-hidden="true" />}
          {phaseLabel[match.phase]}
        </span>
        <span className="rounded bg-gold-200/15 px-2 py-0.5 text-xs font-semibold text-gold-200">
          {queueModes[match.mode ?? 'vote'].short}
        </span>
        {match.gameNumber > 1 && <span className="text-xs text-ash">Partida {match.gameNumber}</span>}
        {inMatch && (
          <span className="ml-auto font-cond text-base font-semibold tabular-nums text-gold-50">{formatDuration(seconds)}</span>
        )}
      </div>

      {noTeams ? (
        <div className="grid grid-cols-2 gap-1.5">
          {match.players.map((p) => (
            <PlayerChip key={p.id} player={p} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {(['blue', 'red'] as Side[]).map((side) => (
            <div key={side} className="min-w-0">
              <p className={`mb-1 text-xs font-semibold ${sideStyle[side].text}`}>{sideStyle[side].name}</p>
              <div className="flex flex-col gap-1">
                {match.players
                  .filter((p) => p.team === side)
                  .map((p) => (
                    <PlayerChip key={p.id} player={p} />
                  ))}
              </div>
            </div>
          ))}
          {withoutTeam.length > 0 && (
            <p className="col-span-2 text-xs text-ash">
              Sem time ainda: {withoutTeam.map((p) => splitRiotId(p.riotId)[0]).join(', ')}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

// Todos os lobbies abertos agora (votação, draft, partida...), para qualquer jogador acompanhar da tela inicial.
export default function LiveMatches() {
  const { data } = useApi<{ matches: LiveMatch[]; recent?: RecentResult[]; now: number }>('/lobby/live', REFRESH_MS)
  // Servidor sem esse recurso (versão antiga) ou fora do ar: o card simplesmente não aparece.
  const skew = data ? data.now - Date.now() : 0
  const { now, visible: recent } = useVisibleResults(data?.recent, skew)
  if (!data) return null

  // Um lobby que acabou de terminar já aparece no resumo de "Fim de jogo": não repete o cartão dele.
  const finishedNow = new Set(recent.map((r) => r.lobbyId))
  const matches = data.matches
    .map(normalize)
    .filter((m) => !((m.phase === 'finished' || m.phase === 'rematch') && finishedNow.has(m.id)))
  const count = matches.length + recent.length

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Partidas ao vivo <span className="font-cond text-base text-ash">({matches.length})</span>
        </span>
      }
      bodyClassName="p-3"
    >
      {count === 0 ? (
        <p className="px-2 py-3 text-center text-sm text-ash">Nenhuma partida acontecendo agora.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {recent.map((result) => (
            <MatchResultCard key={result.matchId} result={result} now={now} />
          ))}
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} skew={skew} />
          ))}
        </ul>
      )}
    </Panel>
  )
}
