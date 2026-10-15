import { useState, type FormEvent } from 'react'
import { useAction } from '../../hooks/useAction'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import ConfirmDialog from '../ui/ConfirmDialog'
import HexButton from '../ui/HexButton'
import { ActionFeedback, Empty, RowAction } from './adminShared'

interface AdminBan {
  riotId: string
  reason: string | null
  bannedAt: string
  bannedBy: string | null
  userId: number | null // null = Riot ID ainda sem conta
}

type Pending = { kind: 'ban'; riotId: string; reason: string } | { kind: 'unban'; ban: AdminBan }

const inputClass =
  'h-10 w-full rounded-md border border-rim bg-panel px-3 text-gold-50 placeholder-ash-dim outline-none transition-colors focus:border-gold-200'

// Banimentos por Riot ID: quem é banido não loga (nem se cadastra) e aparece como "Banido" na tabela.
export default function AdminBans() {
  const { data, error, loading, reload } = useApi<{ bans: AdminBan[] }>('/admin/bans')
  const { busy, message, run, clear } = useAction()
  const [riotId, setRiotId] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!riotId.trim()) return
    setPending({ kind: 'ban', riotId: riotId.trim(), reason: reason.trim() })
  }

  async function confirm() {
    if (!pending) return
    const ok =
      pending.kind === 'ban'
        ? await run(
            () => api('/admin/bans', { body: { riotId: pending.riotId, reason: pending.reason } }),
            `${pending.riotId} foi banido.`,
            reload,
          )
        : await run(
            () => api('/admin/bans/remove', { body: { riotId: pending.ban.riotId } }),
            `${pending.ban.riotId} foi desbanido.`,
            reload,
          )
    if (ok && pending.kind === 'ban') {
      setRiotId('')
      setReason('')
    }
    setPending(null)
  }

  return (
    <div className="space-y-4">
      <ActionFeedback message={message} onClose={clear} />

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-xl border border-rim bg-abyss p-4">
        <label className="block min-w-48 flex-1">
          <span className="text-xs font-semibold text-ash">Riot ID</span>
          <input
            className={`${inputClass} mt-1`}
            placeholder="Nome#TAG"
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
          />
        </label>
        <label className="block min-w-48 flex-[2]">
          <span className="text-xs font-semibold text-ash">Motivo (opcional)</span>
          <input
            className={`${inputClass} mt-1`}
            placeholder="Ex.: saiu no meio da partida várias vezes"
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <HexButton type="submit" variant="danger" disabled={busy || !riotId.trim()}>
          Banir
        </HexButton>
      </form>
      <p className="text-xs text-ash">
        Funciona mesmo para quem ainda não tem conta (o Riot ID fica bloqueado para cadastro). Quem já tem conta é
        deslogado na hora, sai da fila e continua na tabela, marcado como banido.
      </p>

      {loading && !data ? (
        <p className="text-ash">Carregando...</p>
      ) : !data ? (
        <ActionFeedback message={{ tone: 'error', text: error || 'Erro ao carregar.' }} onClose={reload} />
      ) : data.bans.length === 0 ? (
        <Empty>Ninguém banido.</Empty>
      ) : (
        <ul className="divide-y divide-rim overflow-hidden rounded-xl border border-rim">
          {data.bans.map((ban) => (
            <li key={ban.riotId} className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-abyss px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-gold-50">
                  {ban.riotId}
                  {ban.userId === null && (
                    <span className="rounded bg-rim px-1.5 py-0.5 text-[11px] font-semibold text-ash">sem conta</span>
                  )}
                </p>
                <p className="text-xs text-ash">
                  {ban.reason ? `${ban.reason} · ` : ''}
                  {formatDate(ban.bannedAt)}
                  {ban.bannedBy ? ` · por ${ban.bannedBy}` : ''}
                </p>
              </div>
              <RowAction onClick={() => setPending({ kind: 'unban', ban })} disabled={busy}>
                Desbanir
              </RowAction>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'ban' ? `Banir ${pending.riotId}?` : `Desbanir ${pending?.kind === 'unban' ? pending.ban.riotId : ''}?`}
        confirmLabel={pending?.kind === 'ban' ? 'Banir' : 'Desbanir'}
        cancelLabel="Cancelar"
        confirmVariant={pending?.kind === 'ban' ? 'danger' : undefined}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        <p className="text-sm text-ash">
          {pending?.kind === 'ban'
            ? 'A pessoa não consegue mais entrar nem se cadastrar com esse Riot ID. Se estiver logada, é deslogada na hora.'
            : 'A pessoa volta a poder entrar no site normalmente.'}
        </p>
      </ConfirmDialog>
    </div>
  )
}
