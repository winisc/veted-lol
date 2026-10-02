// Caracteres invisíveis que vêm junto ao copiar o nick do cliente do LoL, op.gg etc.
// (\p{Cf}: marcas de direção de texto, zero-width space, BOM...). Ficam fora do Riot ID.
const INVISIBLE = /\p{Cf}/gu
// Espaços "esquisitos" (espaço inquebrável, espaço fino...) viram espaço normal.
const ODD_SPACES = /[\p{Zs}\t]/gu

// Limpeza enquanto o jogador digita ou cola: tira o invisível, mas não mexe em espaços
// nas pontas (senão não daria para digitar um nome com espaço).
export function cleanRiotIdInput(value: string) {
  return value.replace(INVISIBLE, '').replace(ODD_SPACES, ' ')
}

// Forma final usada na busca e no envio: "Nome#TAG", sem espaços sobrando nas pontas ou em volta do #.
export function normalizeRiotId(value: string) {
  const clean = cleanRiotIdInput(value).replace(/ {2,}/g, ' ').trim()
  const index = clean.lastIndexOf('#')
  if (index === -1) return clean
  return `${clean.slice(0, index).trim()}#${clean.slice(index + 1).trim()}`
}

// Mesma regra do backend: "Nome#TAG" — nome de 3 a 16 caracteres, tag de 3 a 5 alfanuméricos.
export function isValidRiotIdFormat(input: string) {
  const value = normalizeRiotId(input)
  const index = value.lastIndexOf('#')
  if (index === -1) return false

  const gameName = value.slice(0, index)
  const tagLine = value.slice(index + 1)
  return gameName.length >= 3 && gameName.length <= 16 && /^[A-Za-z0-9]{3,5}$/.test(tagLine)
}
