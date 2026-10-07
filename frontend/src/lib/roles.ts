// Posições do LoL e seus ícones. Os arquivos ficam no próprio site (public/roles) em vez de num CDN externo,
// que às vezes demora ou falha. Origem: ícones de posição do cliente do LoL (CommunityDragon).
export type Role = 'top' | 'jungle' | 'mid' | 'adc' | 'support'

export interface PlayerRoles {
  main: Role | null
  secondary: Role | null
  worst: Role | null // a role em que o jogador "empena o lobby"
}

export const roleInfo: Record<Role, { name: string; icon: string }> = {
  top: { name: 'Top', icon: '/roles/top.png' },
  jungle: { name: 'Jungle', icon: '/roles/jungle.png' },
  mid: { name: 'Mid', icon: '/roles/mid.png' },
  adc: { name: 'ADC', icon: '/roles/adc.png' },
  support: { name: 'Suporte', icon: '/roles/support.png' },
}

export const roleOrder: Role[] = ['top', 'jungle', 'mid', 'adc', 'support']

export const emptyRoles: PlayerRoles = { main: null, secondary: null, worst: null }
