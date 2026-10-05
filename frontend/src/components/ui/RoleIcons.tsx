import { roleInfo, type PlayerRoles } from '../../lib/roles'

// Três ícones pequenos com as roles do jogador: principal (ouro), secundária (ciano) e a que empena (vermelho, riscada).
const slots = [
  { key: 'main', label: 'Principal', box: 'border-gold-200/70 bg-gold-200/15', icon: '' },
  { key: 'secondary', label: 'Secundária', box: 'border-hex-300/60 bg-hex-300/10', icon: 'opacity-80' },
  { key: 'worst', label: 'Empena', box: 'border-team-red/60 bg-team-red/10', icon: 'opacity-60' },
] as const

export default function RoleIcons({ roles, className = '' }: { roles?: PlayerRoles | null; className?: string }) {
  if (!roles || (!roles.main && !roles.secondary && !roles.worst)) return null
  const summary = slots
    .filter(({ key }) => roles[key])
    .map(({ key, label }) => `${label}: ${roleInfo[roles[key]!].name}`)
    .join(' · ')

  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 ${className}`} title={summary} aria-label={summary}>
      {slots.map(({ key, box, icon }) => {
        const role = roles[key]
        if (!role) return null
        return (
          <span key={key} className={`relative grid h-5 w-5 place-items-center rounded border ${box}`}>
            <img src={roleInfo[role].icon} alt="" className={`h-3.5 w-3.5 ${icon}`} />
            {key === 'worst' && (
              <span aria-hidden="true" className="absolute h-px w-5 rotate-45 bg-team-red" />
            )}
          </span>
        )
      })}
    </span>
  )
}
