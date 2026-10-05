import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { emptyRoles, roleInfo, roleOrder, type PlayerRoles, type Role } from '../lib/roles'
import ConfirmDialog from './ui/ConfirmDialog'
import Notice from './ui/Notice'

type Slot = keyof PlayerRoles

// Cada "vaga" de role com a sua cor: principal em ouro, secundária em ciano, a que empena em vermelho.
const slots: { key: Slot; label: string; short: string; chip: string; active: string }[] = [
  {
    key: 'main',
    label: 'Role principal',
    short: 'Principal',
    chip: 'border-gold-200/50 bg-gold-200/10',
    active: 'border-gold-200 bg-gold-200/20',
  },
  {
    key: 'secondary',
    label: 'Role secundária',
    short: 'Secundária',
    chip: 'border-hex-300/50 bg-hex-300/10',
    active: 'border-hex-300 bg-hex-300/20',
  },
  {
    key: 'worst',
    label: 'Empeno o lobby',
    short: 'Empena',
    chip: 'border-team-red/50 bg-team-red/10',
    active: 'border-team-red bg-team-red/20',
  },
]

// Roles do jogador, no banner do perfil (como as posições preferidas do cliente do LoL / op.gg).
// Visualização: fichas com ícone. "Editar" abre um modal com as 5 posições para cada vaga.
interface Props {
  initial?: PlayerRoles
  tour?: boolean // destaca o botão com borda pulsante e uma dica (vindo do aviso da fila)
  onSaved?: () => void
  readOnly?: boolean // perfil de outro jogador: só mostra as fichas, sem editar
}

export default function ProfileRoles({ initial, tour = false, onSaved, readOnly = false }: Props) {
  const [saved, setSaved] = useState<PlayerRoles>(initial ?? emptyRoles)
  const [draft, setDraft] = useState<PlayerRoles>(saved)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const hasAny = slots.some(({ key }) => saved[key] !== null)
  const tourRef = useRef<HTMLDivElement>(null)

  // No tour, rola a página até o destaque (no celular o banner pode estar fora da tela).
  useEffect(() => {
    if (tour) tourRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [tour])
  const missing = slots.filter(({ key }) => draft[key] === null).length

  function open() {
    setDraft(saved)
    setError('')
    setEditing(true)
  }
  const close = useCallback(() => setEditing(false), [])

  // Uma role não se repete: escolher numa vaga uma role que está em outra tira ela de lá. Clicar de novo desmarca.
  function choose(slot: Slot, role: Role) {
    setDraft((current) => {
      const next = { ...current }
      for (const { key } of slots) if (key !== slot && next[key] === role) next[key] = null
      next[slot] = current[slot] === role ? null : role
      return next
    })
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ roles: PlayerRoles }>('/profile/roles', { method: 'PUT', body: draft })
      setSaved(result.roles)
      setEditing(false)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
        {slots.map((slot) => {
          const role = saved[slot.key]
          if (!role) return null
          return (
            <span
              key={slot.key}
              title={slot.label}
              className={`flex items-center gap-1.5 rounded-md border py-1 pl-1.5 pr-2.5 ${slot.chip}`}
            >
              <img src={roleInfo[role].icon} alt="" className="h-5 w-5" />
              <span className="text-sm font-semibold text-gold-50">{roleInfo[role].name}</span>
              <span className="text-[11px] text-ash">{slot.short}</span>
            </span>
          )
        })}
        {!readOnly && (
        <div ref={tourRef} className="relative">
          <button
            type="button"
            onClick={open}
            className={`rounded-md px-2 py-1 text-sm font-semibold transition-colors ${
              hasAny ? 'text-ash hover:text-gold-50' : 'border border-dashed border-ash-dim text-gold-200 hover:border-gold-200'
            } ${tour ? 'tour-pulse' : ''}`}
          >
            {hasAny ? 'Editar' : '+ Definir minhas roles'}
          </button>
        </div>
        )}
      </div>
      {tour && !readOnly && (
        // Dica do tour, logo abaixo do botão destacado (dentro do banner, que corta o que vaza).
        <p role="status" className="animate-phase-in mt-3 text-sm text-gold-50">
          <span className="font-semibold text-gold-200">Clique no botão destacado</span> e escolha suas 3 roles para
          poder entrar na fila.
        </p>
      )}

      <ConfirmDialog
        open={editing && !readOnly}
        title="Minhas roles"
        confirmLabel={busy ? 'Salvando...' : 'Salvar'}
        busy={busy}
        confirmDisabled={missing > 0}
        onConfirm={save}
        onCancel={close}
      >
        <div className="space-y-3 text-left">
          {slots.map((slot) => {
            const current = draft[slot.key]
            return (
              <div key={slot.key}>
                <p className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold text-gold-50">{slot.label}</span>
                  <span className="text-ash">{current ? roleInfo[current].name : 'Nenhuma'}</span>
                </p>
                <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label={slot.label}>
                  {roleOrder.map((role) => {
                    const selected = current === role
                    return (
                      <button
                        key={role}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={roleInfo[role].name}
                        title={roleInfo[role].name}
                        onClick={() => choose(slot.key, role)}
                        className={`grid h-10 place-items-center rounded-md border transition-colors ${
                          selected ? slot.active : 'border-rim bg-panel hover:border-ash-dim'
                        }`}
                      >
                        <img src={roleInfo[role].icon} alt="" className={`h-6 w-6 ${selected ? '' : 'opacity-40'}`} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <p className="text-xs text-ash">
            {missing > 0
              ? `Escolha uma role para cada vaga para salvar (falta${missing > 1 ? 'm' : ''} ${missing}).`
              : 'Tudo certo. Uma role não se repete entre as vagas.'}
          </p>
          {error && <Notice>{error}</Notice>}
        </div>
      </ConfirmDialog>
    </>
  )
}
