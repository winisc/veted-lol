import type { ReactNode } from 'react'

type Tone = 'error' | 'warning' | 'info'

const tones: Record<Tone, string> = {
  error: 'border-team-red/40 bg-team-red/10 text-[#f3a6a8]',
  warning: 'border-gold-200/30 bg-gold-200/10 text-gold-200',
  info: 'border-hex-300/30 bg-hex-300/10 text-hex-100',
}

// Mensagem de erro/aviso.
export default function Notice({ tone = 'error', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${tones[tone]} ${className}`}>
      {children}
    </p>
  )
}
