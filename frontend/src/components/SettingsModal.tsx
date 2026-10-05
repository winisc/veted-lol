import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { notifyEnabled, notifyState, requestNotifyPermission, setNotifyEnabled, type NotifyState } from '../lib/notify'
import { FOUND_SOUND_URL, getQueueVolume, setQueueVolume } from '../lib/sound'
import ConfirmDialog from './ui/ConfirmDialog'
import HexButton from './ui/HexButton'
import Notice from './ui/Notice'

function SpeakerIcon({ muted, className = 'h-5 w-5' }: { muted: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
      {muted ? (
        <path d="m16 9.5 5 5m0-5-5 5" strokeLinecap="round" />
      ) : (
        <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" strokeLinecap="round" />
      )}
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" />
    </svg>
  )
}

function GearIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={`shrink-0 ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

const inputClass =
  'mt-1 h-10 w-full rounded-md border border-rim bg-panel px-3 text-gold-50 placeholder-ash-dim outline-none transition-colors focus:border-gold-200'

// Interruptor liga/desliga.
function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
        on ? 'border-gold-200 bg-gold-200/30' : 'border-rim bg-panel'
      }`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${on ? 'left-6 bg-gold-200' : 'left-0.5 bg-ash'}`} />
    </button>
  )
}

interface PasswordFormProps {
  onSubmit: () => void
  valid: boolean
  current: string
  next: string
  confirm: string
  setCurrent: (v: string) => void
  setNext: (v: string) => void
  setConfirm: (v: string) => void
  error: string
}

// Troca de senha: pede a atual e a nova duas vezes.
function PasswordForm({ onSubmit, valid, current, next, confirm, setCurrent, setNext, setConfirm, error }: PasswordFormProps) {
  const mismatch = confirm.length > 0 && next !== confirm
  return (
    <form
      className="space-y-3 text-left"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit()
      }}
    >
      <label className="block text-sm font-medium text-gold-50">
        Senha atual
        <input className={inputClass} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </label>
      <label className="block text-sm font-medium text-gold-50">
        Nova senha
        <input
          className={inputClass}
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          placeholder="Mínimo de 6 caracteres"
        />
      </label>
      <label className="block text-sm font-medium text-gold-50">
        Repetir a nova senha
        <input className={inputClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </label>
      {mismatch && <p className="text-xs text-team-red">As senhas não são iguais.</p>}
      {error && <Notice>{error}</Notice>}
    </form>
  )
}

// Configurações do jogador, num modal central: som e notificação da fila, e troca de senha.
export default function SettingsModal() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'main' | 'password'>('main')
  const [volume, setVolume] = useState(getQueueVolume)
  const preview = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  // Notificações do navegador (a permissão é do navegador; o interruptor é nosso).
  const [notifyOn, setNotifyOn] = useState(notifyEnabled)
  const [permission, setPermission] = useState<NotifyState>(notifyState)

  // Troca de senha
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordDone, setPasswordDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const passwordValid = current.length > 0 && next.length >= 6 && next === confirm

  const stop = useCallback(() => {
    preview.current?.pause()
    preview.current = null
    setPlaying(false)
  }, [])

  const close = useCallback(() => {
    stop()
    setOpen(false)
    setView('main')
    setCurrent('')
    setNext('')
    setConfirm('')
    setPasswordError('')
  }, [stop])

  // Esc e clique fora: na troca de senha só voltam para as configurações.
  const back = useCallback(() => {
    setView('main')
    setPasswordError('')
  }, [])

  function openModal() {
    setPermission(notifyState())
    setNotifyOn(notifyEnabled())
    setPasswordDone(false)
    setOpen(true)
  }

  // Para a prévia se o componente sair da tela com o som tocando.
  useEffect(() => () => preview.current?.pause(), [])

  function change(value: number) {
    setVolume(value)
    setQueueVolume(value)
    if (preview.current) preview.current.volume = value
  }

  // Testar: toca a prévia; com ela tocando, o mesmo botão para.
  function togglePreview() {
    if (playing) return stop()
    const audio = new Audio(FOUND_SOUND_URL)
    audio.volume = volume
    audio.onended = () => setPlaying(false)
    preview.current = audio
    setPlaying(true)
    audio.play().catch(() => setPlaying(false))
  }

  async function toggleNotify(value: boolean) {
    setNotifyOn(value)
    setNotifyEnabled(value)
    if (value && notifyState() === 'default') setPermission(await requestNotifyPermission())
  }

  async function savePassword() {
    setSaving(true)
    setPasswordError('')
    try {
      await api('/auth/password', { method: 'POST', body: { currentPassword: current, newPassword: next } })
      setCurrent('')
      setNext('')
      setConfirm('')
      setPasswordDone(true)
      setView('main')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSaving(false)
    }
  }

  const percent = Math.round(volume * 100)
  const notifyBlocked = permission === 'denied' || permission === 'unsupported'

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Configurações"
        aria-label="Configurações"
        className="p-2 text-ash transition-colors hover:text-gold-50"
      >
        <GearIcon />
      </button>

      {view === 'password' ? (
        <ConfirmDialog
          open={open}
          title="Trocar senha"
          confirmLabel={saving ? 'Salvando...' : 'Trocar senha'}
          cancelLabel="Voltar"
          busy={saving}
          confirmDisabled={!passwordValid}
          onConfirm={savePassword}
          onCancel={back}
        >
          <PasswordForm
            onSubmit={savePassword}
            valid={passwordValid}
            current={current}
            next={next}
            confirm={confirm}
            setCurrent={setCurrent}
            setNext={setNext}
            setConfirm={setConfirm}
            error={passwordError}
          />
        </ConfirmDialog>
      ) : (
        <ConfirmDialog
          open={open}
          title="Configurações"
          onCancel={close}
          actions={
            <HexButton variant="secondary" onClick={close} className="w-full">
              Fechar
            </HexButton>
          }
        >
          <div className="space-y-5 text-left">
            <section>
              <p className="flex items-center justify-between text-sm font-semibold text-gold-50">
                Som de partida encontrada
                <span className="font-cond text-base tabular-nums text-gold-200">{volume === 0 ? 'Mudo' : `${percent}%`}</span>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => change(volume === 0 ? 0.6 : 0)}
                  aria-label={volume === 0 ? 'Ativar som' : 'Silenciar'}
                  title={volume === 0 ? 'Ativar som' : 'Silenciar'}
                  className="text-ash hover:text-gold-50"
                >
                  <SpeakerIcon muted={volume === 0} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={percent}
                  onChange={(e) => change(Number(e.target.value) / 100)}
                  aria-label="Volume"
                  className="h-1.5 flex-1 cursor-pointer accent-gold-200"
                />
                <button
                  type="button"
                  onClick={togglePreview}
                  disabled={volume === 0 && !playing}
                  aria-label={playing ? 'Parar o som' : 'Testar o som'}
                  className={`flex w-24 items-center justify-center gap-1.5 rounded-md border px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    playing ? 'border-gold-200/60 bg-gold-200/10 text-gold-200' : 'border-rim bg-panel text-gold-50 hover:border-ash-dim'
                  }`}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                  {playing ? 'Parar' : 'Testar'}
                </button>
              </div>
              <p className="mt-2 text-xs text-ash">Toca quando a fila fecha, até você aceitar.</p>
            </section>

            <section className="border-t border-rim pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gold-50">Notificação do navegador</p>
                  <p className="text-xs text-ash">
                    {permission === 'unsupported'
                      ? 'Este navegador não oferece notificações.'
                      : permission === 'denied'
                        ? 'Bloqueada no navegador. Libere nas permissões do site para usar.'
                        : 'Avisa quando a partida é encontrada, mesmo em outra aba.'}
                  </p>
                </div>
                <Switch on={notifyOn && !notifyBlocked} onChange={toggleNotify} label="Notificação do navegador" disabled={notifyBlocked} />
              </div>
            </section>

            <section className="border-t border-rim pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gold-50">Senha</p>
                  <p className="text-xs text-ash">{passwordDone ? 'Senha alterada com sucesso.' : 'Troque a senha da sua conta.'}</p>
                </div>
                <HexButton variant="secondary" size="sm" onClick={() => setView('password')}>
                  Trocar senha
                </HexButton>
              </div>
            </section>
          </div>
        </ConfirmDialog>
      )}
    </>
  )
}
