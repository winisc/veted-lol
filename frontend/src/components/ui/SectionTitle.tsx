import type { ReactNode } from 'react'

// Título de cada fase do lobby.
export default function SectionTitle({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-2xl text-gold-50 sm:text-3xl">{title}</h2>
      {children && <div className="mx-auto mt-1 max-w-2xl text-sm text-ash">{children}</div>}
    </div>
  )
}
