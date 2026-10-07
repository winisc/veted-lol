// Efeitos sonoros curtos, gerados na hora com Web Audio (sem arquivos): "tic" da roleta, contagem...
// Têm volume próprio (Configurações), separado do som de partida encontrada; 0 desliga os efeitos.
const VOLUME_KEY = 'sfx-volume'
const OLD_SWITCH_KEY = 'sfx-enabled' // versão anterior: só liga/desliga
const DEFAULT_VOLUME = 0.5
// Teto geral dos efeitos: mesmo em 100% eles ficam abaixo do som da fila (são sons de fundo).
const MASTER = 0.6

export function getSfxVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw === null) return localStorage.getItem(OLD_SWITCH_KEY) === 'off' ? 0 : DEFAULT_VOLUME
    const value = Number(raw)
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME
  }
}

export function setSfxVolume(volume: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, volume))))
  } catch {
    // sem armazenamento: vale só até recarregar
  }
}

let ctx: AudioContext | null = null

// O navegador só libera som depois de um clique/tecla na página. Se o primeiro efeito tentou tocar antes disso (ex.:
// depois de um F5), o áudio fica suspenso; aqui ele é liberado no primeiro clique ou tecla em qualquer lugar do site.
function unlock() {
  if (typeof AudioContext === 'undefined') return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // sem áudio: segue sem efeitos
  }
}
if (typeof window !== 'undefined') {
  for (const event of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(event, unlock, { passive: true })
}

// Saída com o volume dos efeitos; null se estiver no mudo ou o navegador não tiver Web Audio.
function output(): { ac: AudioContext; out: GainNode } | null {
  const volume = getSfxVolume() * MASTER
  if (volume === 0 || typeof AudioContext === 'undefined') return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const out = ctx.createGain()
    out.gain.value = volume
    out.connect(ctx.destination)
    return { ac: ctx, out }
  } catch {
    return null
  }
}

// Nota com envelope curto (ataque rápido, queda suave). `to` faz a frequência deslizar.
function tone(
  ac: AudioContext,
  out: AudioNode,
  { freq, to, at = 0, dur, type = 'sine', gain }: { freq: number; to?: number; at?: number; dur: number; type?: OscillatorType; gain: number },
) {
  const start = ac.currentTime + at
  const osc = ac.createOscillator()
  const env = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur)
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(env).connect(out)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

// Mais limpo de propósito: um elemento principal por momento e volume baixo (são efeitos de fundo).
export const sfx = {
  // Cada pulo da roleta: "tic" discreto (MVP) ou gotinha (bagre).
  tick(kind: 'mvp' | 'bagre') {
    const o = output()
    if (!o) return
    if (kind === 'mvp') tone(o.ac, o.out, { freq: 1200, dur: 0.035, type: 'triangle', gain: 0.06 })
    else tone(o.ac, o.out, { freq: 700, to: 1200, dur: 0.05, gain: 0.08 })
  },

  // Escolhido: duas notas (MVP) ou um "bloop" grave (bagre).
  choose(kind: 'mvp' | 'bagre') {
    const o = output()
    if (!o) return
    if (kind === 'mvp') {
      tone(o.ac, o.out, { freq: 783.99, dur: 0.5, type: 'triangle', gain: 0.1 })
      tone(o.ac, o.out, { freq: 1046.5, at: 0.09, dur: 0.6, type: 'triangle', gain: 0.1 })
    } else {
      tone(o.ac, o.out, { freq: 230, to: 95, dur: 0.4, gain: 0.25 })
    }
  },

  // Últimos segundos do prazo: "tic" curto; o último é mais agudo e um pouco mais longo.
  countdown(final: boolean) {
    const o = output()
    if (!o) return
    tone(o.ac, o.out, { freq: final ? 1320 : 990, dur: final ? 0.16 : 0.06, type: 'triangle', gain: final ? 0.1 : 0.07 })
  },

  // Pick feito no draft: um clique discreto.
  pick() {
    const o = output()
    if (!o) return
    tone(o.ac, o.out, { freq: 720, dur: 0.05, type: 'triangle', gain: 0.07 })
  },

  // Capitães revelados: "tum-TUM" grave.
  captains() {
    const o = output()
    if (!o) return
    tone(o.ac, o.out, { freq: 196, dur: 0.25, type: 'triangle', gain: 0.14 })
    tone(o.ac, o.out, { freq: 293.66, at: 0.18, dur: 0.45, type: 'triangle', gain: 0.14 })
  },

  // Confirmação de partida: um "tic" a cada pessoa que aceita.
  accepted() {
    const o = output()
    if (!o) return
    tone(o.ac, o.out, { freq: 1050, dur: 0.05, gain: 0.06 })
  },

  // Alguém não aceitou a partida: um tom curto descendo.
  declined() {
    const o = output()
    if (!o) return
    tone(o.ac, o.out, { freq: 240, to: 150, dur: 0.3, type: 'triangle', gain: 0.1 })
  },

  // Voto confirmado (capitão, resultado, MVP, bagre): clique sutil.
  vote() {
    const o = output()
    if (!o) return
    tone(o.ac, o.out, { freq: 1500, dur: 0.03, type: 'triangle', gain: 0.05 })
  },

  // Você foi o escolhido: fanfarra curta (MVP) ou o "uón-uón" de quem se deu mal (bagre).
  itsYou(kind: 'mvp' | 'bagre') {
    const o = output()
    if (!o) return
    if (kind === 'mvp') {
      ;[783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone(o.ac, o.out, { freq: f, at: i * 0.08, dur: 0.4, type: 'triangle', gain: 0.08 }))
    } else {
      ;[
        [311, 294],
        [294, 277],
        [277, 220],
      ].forEach(([from, to], i) => tone(o.ac, o.out, { freq: from, to, at: i * 0.32, dur: i === 2 ? 0.6 : 0.28, type: 'triangle', gain: 0.1 }))
    }
  },
}
