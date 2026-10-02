import { useState } from 'react'
import { useAction } from '../../hooks/useAction'
import { useApi } from '../../hooks/useApi'
import type { LobbyPhase, MatchOutcome, Side } from '../../hooks/useLobby'
import { api } from '../../lib/api'
import { queueModes, type QueueMode } from '../../lib/modes'
import { formatDuration, sideStyle, splitRiotId } from '../../lib/teams'
import HexButton from '../ui/HexButton'
import { CheckIcon, CrownIcon } from '../ui/icons'
import Panel from '../ui/Panel'
import SummonerIcon from '../ui/SummonerIcon'
import ConfirmDialog from '../ui/ConfirmDialog'
import MatchResultCard, { useVisibleResults, type RecentResult } from '../MatchResultCard'
import { ActionFeedback, Empty, RowAction, matchPhases, phaseLabel } from './adminShared'

interface Player {
  id: number
  riotId: string
  iconId: number
}

interface LiveResponse {
  queue: {
    required: number
    waiting: (Player & { mode: QueueMode })[]
    readyChecks: { id: string; mode: QueueMode; endsAt: number; players: (Player & { accepted: boolean })[] }[]
  }
  lobbies: {
    id: string
    mode: QueueMode
    phase: LobbyPhase
    gameNumber: number
    createdAt: number
    startedAt: number | null
    players: (Player & { team: Side | null; isCaptain: boolean })[]
  }[]
  recentResults?: RecentResult[] // partidas que acabaram de terminar (resumo por alguns segundos)
  now?: number
}

type Pending =
  | { kind: 'remove'; player: Player }
  | { kind: 'clear' }
  | { kind: 'cancel'; lobbyId: string }
  | { kind: 'result'; lobbyId: string }

const REFRESH_MS = 3000

function PlayerChip({ player, children }: { player: Player; children?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-md bg-panel px-2 py-1">
      <SummonerIcon iconId={player.iconId} size="xs" ring="dim" />
      <span className="truncate text-sm font-semibold text-gold-50">{splitRiotId(player.riotId)[0]}</span>
      {children}
    </span>
  )
}

export default function AdminLive() {
  const { data, error, loading, reload } = useApi<LiveResponse>('/admin/live', REFRESH_MS)
  const { busy, message, run, clear } = useAction()
  const [pending, setPending] = useState<Pending | null>(null)
  const close = () => setPending(null)
  const { now, visible: recent } = useVisibleResults(data?.recentResults, data?.now ? data.now - Date.now() : 0)

  async function act(action: () => Promise<unknown>, success: string) {
    await run(action, success, reload)
    close()
  }

  if (loading && !data) return <p className="text-ash">Carregando...</p>
  if (!data) return <ActionFeedback message={{ tone: 'error', text: error || 'Erro ao carregar.' }} onClose={reload} />

  const { queue, lobbies } = data

  return (
    <div className="space-y-4">
      <ActionFeedback message={message} onClose={clear} />
      <p className="text-xs text-ash">Atualiza sozinho a cada {REFRESH_MS / 1000} segundos.</p>

      {recent.length > 0 && (
        <Panel title="Acabaram de terminar">
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {recent.map((result) => (
              <MatchResultCard key={result.matchId} result={result} now={now} />
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.6fr]">
        {/* Fila e confirmações */}
        <Panel
          title={
            <>
              Fila <span className="font-cond text-base text-ash">({queue.waiting.length})</span>
            </>
          }
          action={
            <RowAction danger disabled={queue.waiting.length === 0 || busy} onClick={() => setPending({ kind: 'clear' })}>
              Esvaziar fila
            </RowAction>
          }
        >
          <div className="space-y-4">
            {queue.waiting.length === 0 ? (
              <Empty>Ninguém esperando na fila.</Empty>
            ) : (
              <ol className="space-y-1.5">
                {queue.waiting.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="w-5 text-right font-cond text-sm text-ash-dim">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <PlayerChip player={p}>
                        <span className="ml-auto text-[11px] text-ash">{queueModes[p.mode].short}</span>
                      </PlayerChip>
                    </div>
                    <RowAction disabled={busy} onClick={() => setPending({ kind: 'remove', player: p })}>
                      Tirar
                    </RowAction>
                  </li>
                ))}
              </ol>
            )}

            {queue.readyChecks.map((check) => (
              <div key={check.id} className="rounded-lg border border-gold-200/30 bg-gold-200/[0.05] p-3">
                <p className="mb-2 text-sm font-semibold text-gold-200">
                  Confirmação de partida ({queueModes[check.mode].short}) · {check.players.filter((p) => p.accepted).length}/{check.players.length} aceitaram
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {check.players.map((p) => (
                    <li key={p.id} className="flex items-center gap-1.5">
                      <div className="min-w-0 flex-1">
                        <PlayerChip player={p}>
                          {p.accepted && <CheckIcon className="h-3.5 w-3.5 text-hex-300" />}
                        </PlayerChip>
                      </div>
                      <RowAction disabled={busy} onClick={() => setPending({ kind: 'remove', player: p })} title="Tirar da fila">
                        ✕
                      </RowAction>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>

        {/* Lobbies em andamento */}
        <Panel
          title={
            <>
              Lobbies ativos <span className="font-cond text-base text-ash">({lobbies.length})</span>
            </>
          }
        >
          {lobbies.length === 0 ? (
            <Empty>Nenhum lobby aberto agora.</Empty>
          ) : (
            <ul className="space-y-3">
              {lobbies.map((lobby) => {
                const inMatch = matchPhases.includes(lobby.phase)
                const teams = (['blue', 'red'] as Side[]).map((side) => ({
                  side,
                  players: lobby.players.filter((p) => p.team === side),
                }))
                const noTeams = lobby.players.every((p) => p.team === null)
                return (
                  <li key={lobby.id} className="rounded-lg border border-rim bg-panel/50 p-3">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          inMatch ? 'bg-hex-300/15 text-hex-300' : 'bg-rim text-gold-50'
                        }`}
                      >
                        {phaseLabel[lobby.phase]}
                      </span>
                      <span className="rounded bg-gold-200/15 px-2 py-0.5 text-xs font-semibold text-gold-200">
                        {queueModes[lobby.mode].short}
                      </span>
                      {lobby.gameNumber > 1 && <span className="text-xs text-ash">Partida {lobby.gameNumber}</span>}
                      {lobby.startedAt && inMatch && (
                        <span className="font-cond text-sm text-ash">
                          {formatDuration((Date.now() - lobby.startedAt) / 1000)} de jogo
                        </span>
                      )}
                      <div className="ml-auto flex gap-1.5">
                        {inMatch && (
                          <RowAction disabled={busy} onClick={() => setPending({ kind: 'result', lobbyId: lobby.id })}>
                            Encerrar partida
                          </RowAction>
                        )}
                        <RowAction danger disabled={busy} onClick={() => setPending({ kind: 'cancel', lobbyId: lobby.id })}>
                          Cancelar lobby
                        </RowAction>
                      </div>
                    </div>

                    {noTeams ? (
                      <div className="flex flex-wrap gap-1.5">
                        {lobby.players.map((p) => (
                          <PlayerChip key={p.id} player={p}>
                            {p.isCaptain && <CrownIcon className="h-3.5 w-3.5 text-gold-200" />}
                          </PlayerChip>
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {teams.map(({ side, players }) => (
                          <div key={side}>
                            <p className={`mb-1 text-xs font-semibold ${sideStyle[side].text}`}>{sideStyle[side].name}</p>
                            <div className="flex flex-col gap-1">
                              {players.map((p) => (
                                <PlayerChip key={p.id} player={p}>
                                  {p.isCaptain && <CrownIcon className="h-3.5 w-3.5 text-gold-200" />}
                                </PlayerChip>
                              ))}
                            </div>
                          </div>
                        ))}
                        {lobby.players.some((p) => p.team === null) && (
                          <p className="text-xs text-ash sm:col-span-2">
                            Sem time ainda: {lobby.players.filter((p) => p.team === null).map((p) => splitRiotId(p.riotId)[0]).join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Confirmações */}
      <ConfirmDialog
        open={pending?.kind === 'remove'}
        title="Tirar da fila?"
        confirmLabel="Tirar da fila"
        confirmVariant="danger"
        busy={busy}
        onCancel={close}
        onConfirm={() =>
          pending?.kind === 'remove' &&
          act(
            () => api('/admin/queue/remove', { body: { userId: pending.player.id } }),
            `${pending.player.riotId} saiu da fila.`,
          )
        }
      >
        <p className="text-sm text-ash">
          {pending?.kind === 'remove' && (
            <>
              <span className="font-semibold text-gold-50">{pending.player.riotId}</span> sai da fila e recebe um aviso. Se
              estiver numa confirmação de partida, os outros voltam para a fila.
            </>
          )}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'clear'}
        title="Esvaziar a fila?"
        confirmLabel="Esvaziar"
        confirmVariant="danger"
        busy={busy}
        onCancel={close}
        onConfirm={() => act(() => api('/admin/queue/clear', { method: 'POST' }), 'Fila esvaziada.')}
      >
        <p className="text-sm text-ash">Todos que estão esperando saem da fila. Confirmações em andamento continuam.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'cancel'}
        title="Cancelar o lobby?"
        confirmLabel="Cancelar lobby"
        cancelLabel="Voltar"
        confirmVariant="danger"
        busy={busy}
        onCancel={close}
        onConfirm={() =>
          pending?.kind === 'cancel' &&
          act(() => api(`/admin/lobbies/${pending.lobbyId}/cancel`, { method: 'POST' }), 'Lobby cancelado.')
        }
      >
        <p className="text-sm text-ash">
          Todos os jogadores voltam para o início com um aviso. A partida em andamento não é salva no histórico.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'result'}
        title="Encerrar a partida"
        onCancel={close}
        actions={
          <div className="grid gap-2">
            {(
              [
                ['blue', 'Vitória do Azul', 'secondary'],
                ['red', 'Vitória do Vermelho', 'secondary'],
                ['remake', 'Remake (não conta)', 'secondary'],
              ] as [MatchOutcome, string, 'secondary'][]
            ).map(([outcome, label]) => (
              <HexButton
                key={outcome}
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  pending?.kind === 'result' &&
                  act(
                    () => api(`/admin/lobbies/${pending.lobbyId}/result`, { body: { outcome } }),
                    `Partida encerrada: ${label}.`,
                  )
                }
              >
                {label}
              </HexButton>
            ))}
            <button type="button" onClick={close} className="mt-1 text-sm text-ash hover:text-gold-50">
              Voltar
            </button>
          </div>
        }
      >
        <p className="text-sm text-ash">
          A partida termina agora com o resultado escolhido, sem votação de MVP nem de bagre, e vai para o histórico.
        </p>
      </ConfirmDialog>
    </div>
  )
}
