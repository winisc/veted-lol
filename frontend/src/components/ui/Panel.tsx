import type { ReactNode } from 'react'

interface Props {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

// Card padrão: superfície chapada, borda fina neutra, cantos arredondados.
export default function Panel({ title, action, children, className = '', bodyClassName = 'p-5' }: Props) {
  return (
    <section className={`rounded-xl border border-rim bg-abyss ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-rim px-5 py-3.5">
          <h2 className="font-display text-lg text-gold-50">{title}</h2>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
