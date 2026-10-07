import type { PlayerRoles } from '../../shared/types/roles'

export interface User {
  id: number
  gameName: string
  tagLine: string
  passwordHash: string
  iconId: number // ícone de invocador (da Riot ou um padrão)
  isAdmin: boolean // marcado no banco OU listado em ADMIN_RIOT_IDS no .env
  createdAt: string // ISO 8601, UTC
  roles: PlayerRoles
  simElo: string | null // elo simulado (só bots do simulador): JSON, ou 'none' para sem rank
  puuid: string | null // identificador da conta na Riot (preenchido na primeira consulta de elo)
}

export interface PublicUser {
  id: number
  riotId: string
  iconId: number
  isAdmin: boolean
}
