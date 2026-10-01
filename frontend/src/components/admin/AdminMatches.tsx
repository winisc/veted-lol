import { useState } from 'react'
import { useAction } from '../../hooks/useAction'
import { useApi } from '../../hooks/useApi'
import type { MatchOutcome, Side } from '../../hooks/useLobby'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { formatDuration, sideStyle, splitRiotId } from '../../lib/teams'
import ConfirmDialog from '../ui/ConfirmDialog'
import HexButton from '../ui/HexButton'
import { CrownIcon, StarIcon } from '../ui/icons'
import SummonerIcon from '../ui/SummonerIcon'
import { ActionFeedback, Empty, RowAction, outcomeBadge, outcomeLabel } from './adminShared'

interface AdminMatch {
  id: string
  startedAt: string
  endedAt: string
  durationSeconds: number
  outcome: MatchOutcome
  mvpId: number | null
  players: { userId: number; riotId: string; iconId: number; side: Side; isCaptain: boolean }[]
}

type Pending = { kind: 'edit'; match: AdminMatch } | { kind: 'delete'; match: AdminMatch }

export default function AdminMatches() {
  const { data, error, loading, reload } = useApi<{ matches: AdminMatch[] }>('/admin/matches')
  const { busy, message, run, clear } = useAction()
  const [pending, setPending] = useState<Pending | null>(null)
  const close = () => setPending(null)

  async function act(action: () => Promise<unknown>, success: string) {
    await run(action, success, reload)
    close()
  }

  if (loading && !data) return <p className="text-ash">Carregando...</p>
  if (!data) return <ActionFeedback message={{ tone: 'error', text: error || 'Erro ao carregar.' }} onClose={reload} />

  return (
    <div className="space-y-4">
      <ActionFeedback message={message} onClose={clear} />
      <p className="text-xs text-ash">
        Últimas {data.matches.length} partidas. Corrigir ou apagar uma partida recalcula a tabela e os perfis na hora.
      </p>

      {data.matches.length === 0 ? (
        <Empty>Nenhuma partida salva ainda.</Empty>
      ) : (
        <ul className="space-y-3">
          {data.matches.map((match) => {
            const mvp = match.players.find((p) => p.userId === match.mvpId)
            return (
              <li key={match.id} className="rounded-xl border border-rim bg-abyss p-4">
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${outcomeBadge[match.outcome]}`}>
                    {outcomeLabel[match.outcome]}
                  </span>
                  <span className="text-sm text-ash">{formatDateTime(match.endedAt)}</span>
                  <span className="font-cond text-sm text-ash">{formatDuration(match.durationSeconds)}</span>
                  {mvp && (
                    <span className="flex items-center gap-1 text-sm text-gold-200">
                      <StarIcon className="h-3.5 w-3.5" /> MVP {splitRiotId(mvp.riotId)[0]}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    <RowAction disabled={busy} onClick={() => setPending({ kind: 'edit', match })}>
                      Corrigir resultado
                    </RowAction>
                    <RowAction danger disabled={busy} onClick={() => setPending({ kind: 'delete', match })}>
                      Apagar
                    </RowAction>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(['blue', 'red'] as Side[]).map((side) => (
                    <div key={side}>
                      <p className={`mb-1 text-xs font-semibold ${sideStyle[side].text}`}>
                        {sideStyle[side].name}
                        {match.outcome === side && <span className="ml-1.5 text-gold-200">· venceu</span>}
                      </p>
                      <ul className="flex flex-wrap gap-1">
                        {match.players
                          .filter((p) => p.side === side)
                          .map((p) => (
                            <li key={p.userId} className="flex items-center gap-1.5 rounded-md bg-panel px-2 py-1 text-sm text-gold-50">
                              <SummonerIcon iconId={p.iconId} size="xs" ring="dim" />
                              {splitRiotId(p.riotId)[0]}
                              {p.isCaptain && <CrownIcon className="h-3.5 w-3.5 text-gold-200" />}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pending?.kind === 'edit'}
        title="Corrigir resultado"
        onCancel={close}
        actions={
          <div className="grid gap-2">
            {(['blue', 'red', 'remake'] as MatchOutcome[]).map((outcome) => {
              const current = pending?.kind === 'edit' && pending.match.outcome === outcome
              return (
                <HexButton
                  key={outcome}
                  variant="secondary"
                  disabled={busy || current}
                  onClick={() =>
                    pending?.kind === 'edit' &&
                    act(
                      () => api(`/admin/matches/${pending.match.id}`, { method: 'PATCH', body: { outcome } }),
                      `Resultado corrigido para: ${outcomeLabel[outcome]}.`,
                    )
                  }
                >
                  {outcomeLabel[outcome]}
                  {current && ' (atual)'}
                </HexButton>
              )
            })}
            <button type="button" onClick={close} className="mt-1 text-sm text-ash hover:text-gold-50">
              Voltar
            </button>
          </div>
        }
      >
        <p className="text-sm text-ash">
          Vitórias, derrotas e pontos de todos os jogadores da partida são recalculados. Se o MVP ficar no time que perdeu
          (ou virar remake), o MVP é removido.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title="Apagar a partida?"
        confirmLabel="Apagar partida"
        cancelLabel="Voltar"
        confirmVariant="danger"
        busy={busy}
        onCancel={close}
        onConfirm={() =>
          pending?.kind === 'delete' &&
          act(() => api(`/admin/matches/${pending.match.id}`, { method: 'DELETE' }), 'Partida apagada do histórico.')
        }
      >
        <p className="text-sm text-ash">
          A partida some do histórico de todos os jogadores e deixa de contar na tabela. Não dá para desfazer.
        </p>
      </ConfirmDialog>
    </div>
  )
}
