import { useEffect, useRef, useState } from 'react'
import { useQueue } from '../context/QueueContext'
import HexButton from './ui/HexButton'
import { CheckIcon } from './ui/icons'

const RING_RADIUS = 52
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

// Bipe curto quando a partida é encontrada (como no cliente do LoL). Falhas são ignoradas
// (alguns navegadores bloqueiam som sem interação; quem entrou na fila clicou, então costuma funcionar).
function playFoundSound() {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    gain.connect(ctx.destination)
    for (const [freq, start] of [
      [660, 0],
      [880, 0.15],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + 0.3)
    }
    setTimeout(() => ctx.close(), 1000)
  } catch {
    // sem som, sem problema
  }
}

// Popup global "Partida encontrada": aparece em qualquer aba quando a fila fecha.
export default function ReadyCheckModal() {
  const { snapshot, skew, busy, accept, decline } = useQueue()
  const check = snapshot?.status === 'ready_check' ? snapshot.readyCheck : null
  const [msLeft, setMsLeft] = useState(0)
  const announced = useRef(false)

  // Contagem regressiva sincronizada com o servidor.
  useEffect(() => {
    if (!check) return
    const tick = () => setMsLeft(Math.max(0, check.endsAt - (Date.now() + skew)))
    tick()
    const timer = setInterval(tick, 100)
    return () => clearInterval(timer)
  }, [check?.endsAt, skew])

  // Som + título da aba enquanto a confirmação está aberta (chama atenção se o jogador estiver em outra aba).
  useEffect(() => {
    if (!check) {
      announced.current = false
      return
    }
    if (!announced.current) {
      announced.current = true
      playFoundSound()
    }
    const original = document.title
    document.title = 'Partida encontrada! · x5 Veted'
    return () => {
      document.title = original
    }
  }, [Boolean(check)])

  if (!check) return null

  const seconds = Math.ceil(msLeft / 1000)
  const progress = check.durationMs > 0 ? msLeft / check.durationMs : 0
  const urgent = seconds <= 5

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ready-check-title"
        aria-describedby="ready-check-desc"
        className="animate-phase-in w-full max-w-sm rounded-xl border border-rim bg-abyss p-6 text-center"
      >
        <h2 id="ready-check-title" className="font-display text-2xl text-gold-50">
          Partida encontrada
        </h2>
        <p id="ready-check-desc" className="mt-1 text-sm text-ash">
          {check.iAccepted
            ? 'Você aceitou. Esperando os outros jogadores...'
            : 'Aceite para entrar no lobby. Se recusar ou não responder a tempo, você sai da fila.'}
        </p>

        {/* Anel com o tempo restante */}
        <div className="relative mx-auto mt-5 grid h-32 w-32 place-items-center" role="timer" aria-live="off">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={RING_RADIUS} fill="none" stroke="var(--color-rim)" strokeWidth="6" />
            <circle
              cx="60"
              cy="60"
              r={RING_RADIUS}
              fill="none"
              stroke={urgent ? 'var(--color-team-red)' : 'var(--color-gold-200)'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${progress * RING_LENGTH} ${RING_LENGTH}`}
              className="transition-[stroke-dasharray] duration-100 ease-linear"
            />
          </svg>
          <span className={`font-cond text-5xl font-bold tabular-nums ${urgent ? 'text-team-red' : 'text-gold-50'}`}>
            {seconds}
          </span>
        </div>

        {/* Quem já aceitou (sem expor quem é quem) */}
        <div className="mt-5">
          <ul className="flex justify-center gap-1.5" aria-label={`${check.accepted} de ${check.total} aceitaram`}>
            {Array.from({ length: check.total }, (_, i) => (
              <li
                key={i}
                className={`grid h-6 w-6 place-items-center rounded-full border transition-colors ${
                  i < check.accepted ? 'border-hex-300 bg-hex-300/20 text-hex-300' : 'border-rim bg-panel'
                }`}
              >
                {i < check.accepted && <CheckIcon className="h-3 w-3" />}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ash">
            <span className="font-cond text-base font-semibold text-gold-50">
              {check.accepted}/{check.total}
            </span>{' '}
            aceitaram
          </p>
        </div>

        {check.iAccepted ? (
          <p className="mt-6 flex items-center justify-center gap-2 rounded-md border border-hex-300/30 bg-hex-300/10 py-2.5 text-sm font-semibold text-hex-100">
            <CheckIcon className="h-4 w-4" /> Partida aceita
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <HexButton variant="secondary" size="lg" onClick={decline} disabled={busy}>
              Recusar
            </HexButton>
            <HexButton size="lg" onClick={accept} disabled={busy} autoFocus>
              Aceitar
            </HexButton>
          </div>
        )}
      </div>
    </div>
  )
}
