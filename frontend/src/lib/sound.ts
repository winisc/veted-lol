// Som de "partida encontrada" (public/match-found.mp3) e o volume escolhido pelo jogador.
// O volume é uma preferência do navegador (localStorage): cada aparelho guarda o seu.
export const FOUND_SOUND_URL = '/match-found.mp3'

const VOLUME_KEY = 'queue-sound-volume'
const DEFAULT_VOLUME = 0.6

export function getQueueVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    const saved = Number(raw)
    return raw !== null && Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME
  }
}

export function setQueueVolume(volume: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, volume))))
  } catch {
    // sem armazenamento (ex.: aba anônima bloqueada): vale só até recarregar
  }
}
