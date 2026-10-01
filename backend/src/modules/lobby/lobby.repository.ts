import type { Lobby } from './lobby.types'

// Estado em memória: os lobbies somem se o servidor reiniciar.
const lobbies = new Map<string, Lobby>()
const lobbyByUser = new Map<number, string>()

export const lobbyRepository = {
  create(lobby: Lobby) {
    lobbies.set(lobby.id, lobby)
    for (const player of lobby.players) lobbyByUser.set(player.userId, lobby.id)
  },

  findById(id: string): Lobby | null {
    return lobbies.get(id) ?? null
  },

  all(): Lobby[] {
    return [...lobbies.values()]
  },

  findByUser(userId: number): Lobby | null {
    const id = lobbyByUser.get(userId)
    return id ? (lobbies.get(id) ?? null) : null
  },

  // Desvincula um jogador; o lobby some quando ninguém mais está nele.
  removeUser(lobby: Lobby, userId: number) {
    if (lobbyByUser.get(userId) === lobby.id) lobbyByUser.delete(userId)
    const stillThere = lobby.players.some((p) => lobbyByUser.get(p.userId) === lobby.id)
    if (!stillThere) lobbies.delete(lobby.id)
  },

  delete(lobby: Lobby) {
    lobbies.delete(lobby.id)
    for (const player of lobby.players) {
      if (lobbyByUser.get(player.userId) === lobby.id) lobbyByUser.delete(player.userId)
    }
  },
}
