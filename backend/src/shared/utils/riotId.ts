export interface RiotId {
  gameName: string
  tagLine: string
}

// Caracteres invisíveis que vêm ao copiar o nick do cliente do LoL, op.gg etc. (marcas de direção
// de texto, zero-width space, BOM) e espaços "esquisitos" (inquebrável...) que viram espaço normal.
const INVISIBLE = /\p{Cf}/gu
const ODD_SPACES = /[\p{Zs}\t]/gu

// Riot ID: "Nome#TAG" — nome de 3 a 16 caracteres, tag de 3 a 5 alfanuméricos.
export function parseRiotId(input: unknown): RiotId | null {
  if (typeof input !== 'string') return null
  const clean = input.replace(INVISIBLE, '').replace(ODD_SPACES, ' ').replace(/ {2,}/g, ' ')
  const index = clean.lastIndexOf('#')
  if (index === -1) return null

  const gameName = clean.slice(0, index).trim()
  const tagLine = clean.slice(index + 1).trim()

  if (gameName.length < 3 || gameName.length > 16) return null
  if (!/^[A-Za-z0-9]{3,5}$/.test(tagLine)) return null

  return { gameName, tagLine }
}

export function formatRiotId(gameName: string, tagLine: string) {
  return `${gameName}#${tagLine}`
}
