import type { ReactNode } from 'react'
import type { ActionMessage } from '../../hooks/useAction'
import type { LobbyPhase, MatchOutcome } from '../../hooks/useLobby'
import Notice from '../ui/Notice'

// Nome legível de cada fase do lobby.
export const phaseLabel: Record<LobbyPhase, string> = {
  voting: 'Votação de capitães',
  captains: 'Capitães definidos',
  coinflip: 'Sorteio',
  order: 'Escolha de ordem',
  side: 'Escolha de lado',
  picking: 'Draft',
  done: 'Times formados',
  playing: 'Em partida',
  result: 'Votando o vencedor',
  mvp: 'Votando o MVP',
  bagre: 'Votando o bagre',
  finished: 'Finalizada',
  rematch: 'Revanche',
}

// Fases em que a partida está rolando (dá para forçar o resultado).
export const matchPhases: LobbyPhase[] = ['playing', 'result', 'mvp', 'bagre']

export const outcomeLabel: Record<MatchOutcome, string> = {
  blue: 'Vitória do Azul',
  red: 'Vitória do Vermelho',
  remake: 'Remake',
}

export const outcomeBadge: Record<MatchOutcome, string> = {
  blue: 'bg-team-blue/15 text-team-blue',
  red: 'bg-team-red/15 text-team-red',
  remake: 'bg-rim text-ash',
}

// Mensagem de resultado de uma ação, com botão de fechar.
export function ActionFeedback({ message, onClose }: { message: ActionMessage | null; onClose: () => void }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2">
      <Notice tone={message.tone === 'error' ? 'error' : 'info'} className="flex-1">
        {message.text}
      </Notice>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar mensagem"
        className="rounded-md px-2 py-1.5 text-ash transition-colors hover:bg-panel hover:text-gold-50"
      >
        ✕
      </button>
    </div>
  )
}

// Estado vazio de uma lista.
export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-rim px-4 py-6 text-center text-sm text-ash">{children}</p>
}

// Botão pequeno de texto para ações em linhas de tabela/lista.
export function RowAction({
  children,
  onClick,
  danger,
  disabled,
  title,
}: {
  children: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
        danger
          ? 'border-team-red/40 text-[#f3a6a8] hover:bg-team-red/15'
          : 'border-rim text-gold-50 hover:border-ash-dim hover:bg-rim'
      }`}
    >
      {children}
    </button>
  )
}
