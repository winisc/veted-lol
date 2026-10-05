// Posições do LoL. Cada jogador escolhe a principal, a secundária e a que "empena o lobby".
export type Role = 'top' | 'jungle' | 'mid' | 'adc' | 'support'
export const ROLES: Role[] = ['top', 'jungle', 'mid', 'adc', 'support']

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as string[]).includes(value)
}

export interface PlayerRoles {
  main: Role | null
  secondary: Role | null
  worst: Role | null // a role em que o jogador "empena o lobby"
}
