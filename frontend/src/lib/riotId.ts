// Mesma regra do backend: "Nome#TAG" — nome de 3 a 16 caracteres, tag de 3 a 5 alfanuméricos.
export function isValidRiotIdFormat(input: string) {
  const index = input.lastIndexOf('#')
  if (index === -1) return false

  const gameName = input.slice(0, index).trim()
  const tagLine = input.slice(index + 1).trim()
  return gameName.length >= 3 && gameName.length <= 16 && /^[A-Za-z0-9]{3,5}$/.test(tagLine)
}
