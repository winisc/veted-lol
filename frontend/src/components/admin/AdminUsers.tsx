import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAction } from '../../hooks/useAction'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatDate, formatPercent } from '../../lib/format'
import { splitRiotId } from '../../lib/teams'
import ConfirmDialog from '../ui/ConfirmDialog'
import SummonerIcon from '../ui/SummonerIcon'
import { ActionFeedback, Empty, RowAction } from './adminShared'

interface AdminUser {
  id: number
  riotId: string
  iconId: number
  isAdmin: boolean
  adminFromEnv: boolean
  createdAt: string
  games: number
  wins: number
  losses: number
  mvps: number
  bagres: number
  winRate: number | null
  points: number
}

type Pending = { kind: 'password'; user: AdminUser } | { kind: 'admin'; user: AdminUser }

const inputClass =
  'h-10 w-full rounded-md border border-rim bg-panel px-3 text-gold-50 placeholder-ash-dim outline-none transition-colors focus:border-gold-200'

export default function AdminUsers() {
  const { user: me } = useAuth()
  const { data, error, loading, reload } = useApi<{ users: AdminUser[] }>('/admin/users')
  const { busy, message, run, clear } = useAction()
  const [pending, setPending] = useState<Pending | null>(null)
  const [search, setSearch] = useState('')
  const [password, setPassword] = useState('')

  const close = () => {
    setPending(null)
    setPassword('')
  }

  async function act(action: () => Promise<unknown>, success: string) {
    await run(action, success, reload)
    close()
  }

  if (loading && !data) return <p className="text-ash">Carregando...</p>
  if (!data) return <ActionFeedback message={{ tone: 'error', text: error || 'Erro ao carregar.' }} onClose={reload} />

  const term = search.trim().toLowerCase()
  const users = data.users.filter((u) => u.riotId.toLowerCase().includes(term))

  return (
    <div className="space-y-4">
      <ActionFeedback message={message} onClose={clear} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Buscar por Riot ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar jogador"
        />
        <span className="text-sm text-ash">
          {users.length} de {data.users.length} jogadores
        </span>
      </div>

      {users.length === 0 ? (
        <Empty>Nenhum jogador encontrado.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-rim">
          <table className="w-full min-w-176 text-left text-sm">
            <thead className="bg-panel text-xs text-ash">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Invocador</th>
                <th className="px-3 py-2.5 text-right font-semibold">Partidas</th>
                <th className="px-3 py-2.5 text-right font-semibold">V / D</th>
                <th className="px-3 py-2.5 text-right font-semibold">Win rate</th>
                <th className="px-3 py-2.5 text-right font-semibold">Pontos</th>
                <th className="px-3 py-2.5 font-semibold">Desde</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rim bg-abyss">
              {users.map((u) => {
                const [name, tag] = splitRiotId(u.riotId)
                const isMe = u.id === me?.id
                const lockAdmin = u.isAdmin && (isMe || u.adminFromEnv)
                return (
                  <tr key={u.id}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <SummonerIcon iconId={u.iconId} size="sm" ring={u.isAdmin ? 'gold' : 'dim'} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-semibold text-gold-50">
                            <span className="truncate">{name}</span>
                            {u.isAdmin && (
                              <span className="rounded bg-gold-200/15 px-1.5 py-0.5 text-[11px] font-semibold text-gold-200">
                                Admin{u.adminFromEnv ? ' (.env)' : ''}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-ash">#{tag}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-cond text-base tabular-nums text-gold-50">{u.games}</td>
                    <td className="px-3 py-2 text-right font-cond text-base tabular-nums">
                      <span className="text-hex-300">{u.wins}</span> / <span className="text-team-red">{u.losses}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-cond text-base tabular-nums text-gold-50">
                      {formatPercent(u.winRate)}
                    </td>
                    <td className="px-3 py-2 text-right font-cond text-base font-semibold tabular-nums text-gold-50">{u.points}</td>
                    <td className="px-3 py-2 text-ash">{formatDate(u.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <RowAction disabled={busy} onClick={() => setPending({ kind: 'password', user: u })}>
                          Redefinir senha
                        </RowAction>
                        <RowAction
                          disabled={busy || lockAdmin}
                          title={
                            lockAdmin
                              ? isMe
                                ? 'Você não pode remover o seu próprio acesso.'
                                : 'Admin definido no .env (ADMIN_RIOT_IDS).'
                              : undefined
                          }
                          onClick={() => setPending({ kind: 'admin', user: u })}
                        >
                          {u.isAdmin ? 'Remover admin' : 'Tornar admin'}
                        </RowAction>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pending?.kind === 'password'}
        title="Redefinir senha"
        confirmLabel="Salvar nova senha"
        busy={busy}
        onCancel={close}
        onConfirm={() =>
          pending?.kind === 'password' &&
          act(
            () => api(`/admin/users/${pending.user.id}/password`, { body: { password } }),
            `Senha de ${pending.user.riotId} redefinida. Passe a nova senha para o jogador.`,
          )
        }
      >
        <div className="space-y-3 text-left">
          <p className="text-center text-sm text-ash">
            Nova senha para <span className="font-semibold text-gold-50">{pending?.user.riotId}</span>.
          </p>
          <input
            className={inputClass}
            type="text"
            placeholder="Mínimo de 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Nova senha"
            autoFocus
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'admin'}
        title={pending?.user.isAdmin ? 'Remover acesso de admin?' : 'Tornar admin?'}
        confirmLabel={pending?.user.isAdmin ? 'Remover admin' : 'Tornar admin'}
        confirmVariant={pending?.user.isAdmin ? 'danger' : 'primary'}
        busy={busy}
        onCancel={close}
        onConfirm={() =>
          pending?.kind === 'admin' &&
          act(
            () => api(`/admin/users/${pending.user.id}/admin`, { body: { isAdmin: !pending.user.isAdmin } }),
            pending.user.isAdmin
              ? `${pending.user.riotId} não é mais admin.`
              : `${pending.user.riotId} agora é admin.`,
          )
        }
      >
        <p className="text-sm text-ash">
          {pending?.user.isAdmin
            ? 'Esse jogador perde o acesso a esta tela.'
            : 'Esse jogador passa a ver a aba Admin e pode gerenciar fila, lobbies, partidas e jogadores.'}
        </p>
      </ConfirmDialog>
    </div>
  )
}
