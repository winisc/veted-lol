// Posições do LoL e seus ícones (CommunityDragon, mesmos ícones do seletor de posição do cliente).
export type Role = 'top' | 'jungle' | 'mid' | 'adc' | 'support'

export interface PlayerRoles {
  main: Role | null
  secondary: Role | null
  worst: Role | null // a role em que o jogador "empena o lobby"
}

const POSITION_ICONS =
  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions'

export const roleInfo: Record<Role, { name: string; icon: string }> = {
  top: { name: 'Top', icon: `${POSITION_ICONS}/icon-position-top.png` },
  jungle: { name: 'Jungle', icon: `${POSITION_ICONS}/icon-position-jungle.png` },
  mid: { name: 'Mid', icon: `${POSITION_ICONS}/icon-position-middle.png` },
  adc: { name: 'ADC', icon: `${POSITION_ICONS}/icon-position-bottom.png` },
  support: { name: 'Suporte', icon: `${POSITION_ICONS}/icon-position-utility.png` },
}

export const roleOrder: Role[] = ['top', 'jungle', 'mid', 'adc', 'support']

export const emptyRoles: PlayerRoles = { main: null, secondary: null, worst: null }
