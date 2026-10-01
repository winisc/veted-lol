export interface RiotId {
  gameName: string
  tagLine: string
}

// Riot ID: "Nome#TAG" — nome de 3 a 16 caracteres, tag de 3 a 5 alfanuméricos.
export function parseRiotId(input: unknown): RiotId | null {
  if (typeof input !== 'string') return null
  const index = input.lastIndexOf('#')
  if (index === -1) return null

  const gameName = input.slice(0, index).trim()
  const tagLine = input.slice(index + 1).trim()

  if (gameName.length < 3 || gameName.length > 16) return null
  if (!/^[A-Za-z0-9]{3,5}$/.test(tagLine)) return null

  return { gameName, tagLine }
}

export function formatRiotId(gameName: string, tagLine: string) {
  return `${gameName}#${tagLine}`
}
