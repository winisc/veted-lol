import type { ReactNode } from 'react'

interface Props {
  splash: string
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  focus?: string // posição da imagem (ex.: 'object-[center_20%]')
  compact?: boolean
}

// Banner com splash art de campeão. A imagem fica à direita e some no fundo à esquerda, onde vai o texto.
export default function PageHero({ splash, title, subtitle, children, focus = 'object-[center_22%]', compact }: Props) {
  return (
    <section
      className={`relative isolate flex flex-col overflow-hidden rounded-xl border border-rim bg-abyss ${
        compact ? 'min-h-40' : 'min-h-64 sm:min-h-72'
      }`}
    >
      <img src={splash} alt="" className={`absolute inset-0 -z-10 h-full w-full object-cover opacity-70 ${focus}`} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-abyss via-abyss/90 to-abyss/20" />

      <div className={`flex flex-1 flex-col justify-end gap-2 ${compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'}`}>
        <h1 className={`max-w-xl font-display leading-tight text-gold-50 ${compact ? 'text-3xl' : 'text-4xl'}`}>{title}</h1>
        {subtitle && <div className="max-w-lg text-base text-ash">{subtitle}</div>}
        {children}
      </div>
    </section>
  )
}
