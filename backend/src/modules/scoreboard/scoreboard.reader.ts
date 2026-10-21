import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createWorker, PSM, type Worker } from 'tesseract.js'
import { dbPath } from '../../database/db'
import type { StatsDraft, StatsDraftRow } from './scoreboard.types'

// Leitura do print do placar, em dois layouts do cliente do LoL (aba "Placar"):
//
//  A. Tela de fim de partida: linhas com barra colorida à esquerda (azul = Equipe 1, vermelho = Equipe 2), nome do
//     campeão escrito, KDA, razão A/M/A, dano a campeões e ouro (sem CS).
//     As 10 linhas são achadas pelas barras; cada linha é recortada em posições fixas relativas à barra.
//  B. Detalhe da partida no histórico: sem barras, campeão só no ícone redondo, KDA, CS e ouro (sem dano).
//     As âncoras são as palavras "EQUIPE 1" e "EQUIPE 2" (achadas por OCR na imagem inteira); o campeão sai
//     comparando o ícone com os ícones oficiais do Data Dragon.
//
// Nos dois, o nick é comparado com os jogadores do lobby (tolerando erros de leitura) e o OCR de cada campo usa só
// os caracteres possíveis. As medidas são dos prints de referência (A: janela 1280x720; B: o mesmo, sem a borda).

const REF_ROW_PITCH = 41 // de uma linha para a próxima (40px de linha + 1px de divisória)
// Caixas de leitura, relativas ao canto superior esquerdo da barra colorida de cada linha (em px do print de referência).
const BOX = {
  nick: { dx: 144, dy: 5, w: 160, h: 13 },
  champ: { dx: 144, dy: 20, w: 160, h: 13 },
  kda: { dx: 663, dy: 5, w: 85, h: 14 },
  ratio: { dx: 663, dy: 20, w: 50, h: 13 },
  damage: { dx: 753, dy: 4, w: 75, h: 16 },
  gold: { dx: 843, dy: 4, w: 80, h: 16 },
}

// Layout B (histórico), relativo ao canto do "EQUIPE" de cada time: distância entre "EQUIPE 1" e "EQUIPE 2",
// onde começa a 1ª linha (centro do texto menos meia altura) e o passo entre linhas.
const HISTORY = {
  teamGap: 181,
  firstRow: 29.5,
  pitch: 29,
  nick: { dx: 94, dy: 0, w: 140, h: 14 },
  kda: { dx: 408, dy: 0, w: 84, h: 14 },
  cs: { dx: 510, dy: 0, w: 50, h: 14 },
  gold: { dx: 566, dy: 0, w: 72, h: 14 },
  icon: { dx: 73.5, dy: 7, r: 10 }, // centro e raio do retrato do campeão
}

const DDRAGON = process.env.DDRAGON_HOST || 'https://ddragon.leagueoflegends.com'
const OCR_CACHE = process.env.OCR_CACHE_DIR || path.join(path.dirname(dbPath), 'ocr-cache')

export interface ScoreboardPlayer {
  userId: number
  riotId: string
  side: 'blue' | 'red'
}

// ---- utilidades ----

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()

function levenshtein(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = tmp
    }
  }
  return prev[b.length]
}

// 0 a 1: o quanto dois textos se parecem (1 = iguais, depois de normalizar).
function similarity(a: string, b: string) {
  const x = normalize(a)
  const y = normalize(b)
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.startsWith(y) || y.startsWith(x)) return 0.9
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length)
}

// Limiar de Otsu: separa texto e fundo de cada recorte (texto branco, amarelo ou cinza).
function otsu(data: Buffer) {
  const hist = new Array<number>(256).fill(0)
  for (const v of data) hist[v]++
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 127
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = data.length - wB
    if (!wF) break
    sumB += t * hist[t]
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2
    if (between > best) {
      best = between
      threshold = t
    }
  }
  return threshold
}

// ---- campeões (Data Dragon) ----

let champions: Promise<{ id: string; name: string }[]> | null = null

function championList() {
  champions ??= (async () => {
    const versions = (await (await fetch(`${DDRAGON}/api/versions.json`)).json()) as string[]
    const data = (await (await fetch(`${DDRAGON}/cdn/${versions[0]}/data/en_US/champion.json`)).json()) as {
      data: Record<string, { id: string; name: string }>
    }
    return Object.values(data.data).map((c) => ({ id: c.id, name: c.name }))
  })().catch((err) => {
    champions = null
    throw err
  })
  return champions
}

function matchChampion(text: string, list: { id: string; name: string }[]): string | null {
  let best: { id: string; score: number } | null = null
  for (const c of list) {
    const score = Math.max(similarity(text, c.name), similarity(text, c.id))
    if (!best || score > best.score) best = { id: c.id, score }
  }
  return best && best.score >= 0.6 ? best.id : null
}

// ---- KDA ----

// O OCR às vezes enxerga um "7" a mais junto da "/" (ex.: "13/5/78" no lugar de "13/5/8"), ou lê a "/" como "7".
// A razão A/M/A logo abaixo ((abates + assistências) / mortes, com 1 casa) decide qual leitura é a certa.
function parseKda(raw: string, ratioText: string): [number, number, number] | null {
  const text = raw.replace(/[^0-9/]/g, '')
  const ratio = Number(ratioText.replace(',', '.').replace(/[^0-9.]/g, ''))
  const fits = (k: number, d: number, a: number) =>
    Number.isFinite(ratio) && ratioText !== '' && Math.abs(Math.round(((k + a) / Math.max(1, d)) * 10) / 10 - ratio) < 0.051

  const candidates: [number, number, number][] = []
  const sevens = [...text].map((c, i) => (c === '7' ? i : -1)).filter((i) => i >= 0)
  // cada "7" pode ser 7 mesmo, uma "/" lida errado ou um 7 que sobrou (3 opções; poucos dígitos, poucas combinações)
  for (let combo = 0; combo < 3 ** sevens.length; combo++) {
    const chars = [...text]
    let rest = combo
    for (const pos of sevens) {
      const option = rest % 3
      rest = Math.floor(rest / 3)
      if (option === 1) chars[pos] = '/'
      if (option === 2) chars[pos] = ''
    }
    const parts = chars.join('').split('/')
    if (parts.length !== 3 || parts.some((p) => p === '' || p.length > 2)) continue
    candidates.push(parts.map(Number) as [number, number, number])
  }
  const original = text.split('/')
  const exact = original.length === 3 && original.every((p) => p !== '' && p.length <= 2) ? (original.map(Number) as [number, number, number]) : null
  if (exact && (fits(...exact) || !ratioText)) return exact
  return candidates.find((c) => fits(...c)) ?? exact ?? null
}

const parseNumber = (text: string) => {
  const digits = text.replace(/[^0-9]/g, '')
  return digits ? Number(digits) : null
}

// ---- OCR ----

let worker: Promise<Worker> | null = null

function ocr() {
  worker ??= createWorker('eng', 1, { cachePath: OCR_CACHE }).catch((err) => {
    worker = null
    throw err
  })
  return worker
}

interface Grid {
  barX: number
  rowTops: number[] // 10 linhas: 5 da Equipe 1 e 5 da Equipe 2
  scale: number // tamanho do print em relação ao de referência
}

// Acha as 10 linhas do placar pelas barras coloridas da esquerda.
async function findGrid(image: sharp.Sharp): Promise<Grid | null> {
  const { data, info } = await image.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const saturated = (x: number, y: number) => {
    const i = (y * width + x) * channels
    return Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 60
  }

  // Trechos verticais coloridos de uma coluna, emendando falhas de até 2px (compressão do JPG).
  const runsAt = (x: number) => {
    const runs: { top: number; len: number }[] = []
    let start = -1
    let lastOn = -10
    for (let y = 0; y <= height; y++) {
      const on = y < height && saturated(x, y)
      if (on) {
        if (start < 0 || y - lastOn > 3) {
          if (start >= 0) runs.push({ top: start, len: lastOn - start + 1 })
          start = y
        }
        lastOn = y
      }
    }
    if (start >= 0) runs.push({ top: start, len: lastOn - start + 1 })
    return runs
  }

  // As 10 linhas: dois blocos coloridos de mesma altura (um por equipe, cada um com 5 linhas coladas), um abaixo
  // do outro. Cada bloco é dividido em 5 linhas iguais (funciona mesmo quando o JPG apaga a divisória entre elas).
  const findRows = (x: number) => {
    const blocks = runsAt(x).filter((r) => r.len >= 60)
    for (let i = 0; i + 1 < blocks.length; i++) {
      const [a, b] = [blocks[i], blocks[i + 1]]
      if (Math.abs(a.len - b.len) > a.len * 0.06 || b.top - (a.top + a.len) < a.len * 0.1) continue
      const pitch = (a.len + b.len + 2) / 10 // altura de uma linha + a divisória
      const tops = [a, b].flatMap((block) => Array.from({ length: 5 }, (_, k) => Math.round(block.top + k * pitch)))
      return { tops, pitch }
    }
    return null
  }

  // A barra é a primeira coluna (da esquerda para a direita) com esse padrão.
  for (let x = 0; x < Math.floor(width * 0.6); x++) {
    const found = findRows(x)
    if (found) return { barX: x, rowTops: found.tops, scale: found.pitch / REF_ROW_PITCH }
  }
  return null
}

interface Origin {
  x: number
  y: number
  scale: number
}

// Recorta a caixa, aumenta para ~4x o tamanho de referência e separa texto e fundo (texto preto no branco).
async function binarize(
  image: sharp.Sharp,
  meta: { width: number; height: number },
  origin: Origin,
  box: { dx: number; dy: number; w: number; h: number },
) {
  const left = Math.max(0, Math.round(origin.x + box.dx * origin.scale))
  const top = Math.max(0, Math.round(origin.y + box.dy * origin.scale))
  const width = Math.min(meta.width - left, Math.round(box.w * origin.scale))
  const height = Math.min(meta.height - top, Math.round(box.h * origin.scale))
  if (width < 4 || height < 4) return null
  const { data, info } = await image
    .clone()
    .extract({ left, top, width, height })
    .grayscale()
    .resize({ width: Math.round(width * (4 / origin.scale)), kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const t = otsu(data)
  const bw = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) bw[i] = data[i] > t ? 0 : 255
  return { bw, width: info.width, height: info.height }
}

async function recognize(img: { bw: Buffer; width: number; height: number }, whitelist: string, mode = PSM.SINGLE_LINE) {
  const png = await sharp(img.bw, { raw: { width: img.width, height: img.height, channels: 1 } })
    .extend({ top: 12, bottom: 12, left: 12, right: 12, background: '#ffffff' })
    .png()
    .toBuffer()
  const w = await ocr()
  await w.setParameters({ tessedit_char_whitelist: whitelist, tessedit_pageseg_mode: mode })
  const { data: result } = await w.recognize(png)
  if (process.env.OCR_DEBUG) console.log('[ocr]', whitelist.slice(0, 12), JSON.stringify(result.text.trim()))
  return result.text.trim()
}

async function readBox(
  image: sharp.Sharp,
  meta: { width: number; height: number },
  origin: Origin,
  box: { dx: number; dy: number; w: number; h: number },
  whitelist: string,
) {
  const img = await binarize(image, meta, origin, box)
  return img ? recognize(img, whitelist) : ''
}

// KDA espaçado ("5 / 2 / 3", tela do histórico): a "/" fina confunde o OCR, então separa a imagem em blocos pelos
// espaços (número, barra, número, barra, número) e lê só os três números, um de cada vez.
async function readSpacedKda(
  image: sharp.Sharp,
  meta: { width: number; height: number },
  origin: Origin,
  box: { dx: number; dy: number; w: number; h: number },
): Promise<[number, number, number] | null> {
  const img = await binarize(image, meta, origin, box)
  if (!img) return null
  const ink = (x: number) => {
    for (let y = 0; y < img.height; y++) if (img.bw[y * img.width + x] === 0) return true
    return false
  }
  // blocos de colunas com tinta, separados por pelo menos ~2,5px (no tamanho de referência, aqui 4x)
  const minGap = 10
  const blocks: { from: number; to: number }[] = []
  let gap = minGap
  for (let x = 0; x < img.width; x++) {
    if (ink(x)) {
      if (gap >= minGap || !blocks.length) blocks.push({ from: x, to: x })
      else blocks[blocks.length - 1].to = x
      gap = 0
    } else gap++
  }
  if (blocks.length !== 5) return null
  // monta uma imagem só com os três números, sem as barras e com um espaço largo entre eles, e lê de uma vez
  // (o OCR erra bem mais lendo um dígito sozinho)
  const space = 40
  const parts = [0, 2, 4].map((i) => blocks[i])
  const width = parts.reduce((sum, p) => sum + (p.to - p.from + 1), 0) + space * (parts.length - 1)
  const joined = Buffer.alloc(width * img.height, 255)
  let at = 0
  for (const { from, to } of parts) {
    const w = to - from + 1
    for (let y = 0; y < img.height; y++) img.bw.copy(joined, y * width + at, y * img.width + from, y * img.width + to + 1)
    at += w + space
  }
  const text = await recognize({ bw: joined, width, height: img.height }, '0123456789 ')
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length === 3 && tokens.every((t) => t.length <= 2)) return tokens.map(Number) as [number, number, number]

  // O OCR costuma juntar os números ("523"): a largura de cada bloco diz quantos dígitos ele tem (1 ou 2).
  const counts = parts.map((p) => (p.to - p.from + 1 > img.height * 0.62 ? 2 : 1))
  const digits = text.replace(/\D/g, '')
  if (digits.length === counts.reduce((a, b) => a + b, 0)) {
    let pos = 0
    return counts.map((c) => Number(digits.slice(pos, (pos += c)))) as [number, number, number]
  }

  // Último recurso: cada número sozinho.
  const single: number[] = []
  for (const { from, to } of parts) {
    const w = to - from + 1
    const part = Buffer.alloc(w * img.height)
    for (let y = 0; y < img.height; y++) img.bw.copy(part, y * w, y * img.width + from, y * img.width + to + 1)
    const one = (await recognize({ bw: part, width: w, height: img.height }, '0123456789', PSM.SINGLE_WORD)).replace(/\D/g, '')
    if (!one || one.length > 2) return null
    single.push(Number(one))
  }
  return single as [number, number, number]
}

// Palavras "EQUIPE" (as duas âncoras do layout B) e se a tela tem "BANS" (só a do histórico tem).
async function findTeamHeaders(image: sharp.Sharp, meta: { width: number }) {
  const zoom = 2
  const big = await image.clone().grayscale().resize({ width: meta.width * zoom }).negate().normalize().png().toBuffer()
  const w = await ocr()
  await w.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: PSM.SPARSE_TEXT })
  const { data } = await w.recognize(big, {}, { blocks: true })
  const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
  const headers = words
    .filter((x) => /EQUIPE/i.test(x.text))
    .map((x) => ({ x: x.bbox.x0 / zoom, y: x.bbox.y0 / zoom }))
    .sort((a, b) => a.y - b.y)
  return { headers, bans: words.some((x) => /BANS/i.test(x.text)) }
}

// Ícones oficiais dos campeões (Data Dragon), guardados no disco; para comparar com o retrato redondo do print.
const ICON = 32 // lado da comparação, em px
const ICON_ZOOM = 0.7 // o retrato redondo mostra só o miolo do ícone quadrado
let iconRefs: Promise<{ id: string; px: Buffer }[]> | null = null

// Pixels RGB do miolo do quadrado (`zoom` = fração do lado), em ICON x ICON.
async function iconPixels(input: Buffer | string, zoom: number) {
  const img = sharp(input)
  const m = await img.metadata()
  const side = Math.round(Math.min(m.width!, m.height!) * zoom)
  return img
    .extract({ left: Math.round((m.width! - side) / 2), top: Math.round((m.height! - side) / 2), width: side, height: side })
    .resize(ICON, ICON)
    .removeAlpha()
    .raw()
    .toBuffer()
}

function championIcons() {
  iconRefs ??= (async () => {
    const versions = (await (await fetch(`${DDRAGON}/api/versions.json`)).json()) as string[]
    const dir = path.join(OCR_CACHE, 'champions', versions[0])
    mkdirSync(dir, { recursive: true })
    const list = await championList()
    const refs: { id: string; px: Buffer }[] = []
    for (let i = 0; i < list.length; i += 10) {
      await Promise.all(
        list.slice(i, i + 10).map(async (c) => {
          const file = path.join(dir, `${c.id}.png`)
          if (!existsSync(file)) {
            const res = await fetch(`${DDRAGON}/cdn/${versions[0]}/img/champion/${c.id}.png`)
            if (!res.ok) return
            writeFileSync(file, Buffer.from(await res.arrayBuffer()))
          }
          refs.push({ id: c.id, px: await iconPixels(readFileSync(file), ICON_ZOOM) })
        }),
      )
    }
    return refs
  })().catch((err) => {
    iconRefs = null
    throw err
  })
  return iconRefs
}

// Diferença média de cor dentro do círculo (0 = iguais).
function iconDistance(a: Buffer, b: Buffer) {
  const r = ICON / 2
  let sum = 0
  let n = 0
  for (let y = 0; y < ICON; y++) {
    for (let x = 0; x < ICON; x++) {
      if ((x - r + 0.5) ** 2 + (y - r + 0.5) ** 2 > (r * 0.9) ** 2) continue
      const i = (y * ICON + x) * 3
      sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
      n++
    }
  }
  return sum / n
}

// Campeão pelo retrato: o ícone mais parecido, se for claramente o mais parecido (senão o capitão escolhe).
async function matchIcon(image: sharp.Sharp, meta: { width: number; height: number }, cx: number, cy: number, r: number) {
  const left = Math.round(cx - r)
  const top = Math.round(cy - r)
  const side = Math.round(2 * r)
  if (left < 0 || top < 0 || left + side > meta.width || top + side > meta.height) return null
  const crop = await image.clone().extract({ left, top, width: side, height: side }).png().toBuffer()
  const px = await iconPixels(crop, 1)
  const refs = await championIcons()
  const ranked = refs.map((ref) => ({ id: ref.id, d: iconDistance(px, ref.px) })).sort((a, b) => a.d - b.d)
  const [best, second] = ranked
  return best && best.d < 135 && (!second || second.d - best.d > 6) ? best.id : null
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzáàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇñÑ0123456789 '._-"

// Liga cada linha lida a um jogador do lobby pelo nick (o mais parecido primeiro). As linhas que sobrarem
// (nick ilegível) ficam com os jogadores que sobraram, preferindo o mesmo time das outras linhas da equipe.
function assignPlayers(nicks: string[], players: ScoreboardPlayer[]): (ScoreboardPlayer | null)[] {
  const gameName = (p: ScoreboardPlayer) => p.riotId.slice(0, p.riotId.lastIndexOf('#'))
  const pairs: { row: number; player: ScoreboardPlayer; score: number }[] = []
  nicks.forEach((nick, row) => players.forEach((player) => pairs.push({ row, player, score: similarity(nick, gameName(player)) })))
  pairs.sort((a, b) => b.score - a.score)
  const result: (ScoreboardPlayer | null)[] = nicks.map(() => null)
  const used = new Set<number>()
  for (const { row, player, score } of pairs) {
    if (score < 0.5 || result[row] || used.has(player.userId)) continue
    result[row] = player
    used.add(player.userId)
  }
  // equipe de cada metade do placar (Equipe 1 = linhas 0-4), pelo time da maioria dos já reconhecidos
  const sideOf = (from: number) => {
    const sides = result.slice(from, from + 5).filter(Boolean).map((p) => p!.side)
    const blue = sides.filter((s) => s === 'blue').length
    return blue >= sides.length - blue ? 'blue' : 'red'
  }
  const groupSide = [sideOf(0), sideOf(5)]
  result.forEach((p, row) => {
    if (p) return
    const wanted = groupSide[row < 5 ? 0 : 1]
    const left = players.filter((x) => !used.has(x.userId))
    const pick = left.find((x) => x.side === wanted) ?? left[0]
    if (pick) {
      result[row] = pick
      used.add(pick.userId)
    }
  })
  return result
}

const emptyRows = (players: ScoreboardPlayer[]): StatsDraftRow[] =>
  players.map((p) => ({ userId: p.userId, champion: null, kills: null, deaths: null, assists: null, cs: null, gold: null, damage: null }))

export async function readScoreboard(imageData: Buffer, players: ScoreboardPlayer[]): Promise<StatsDraft> {
  const notStandard: StatsDraft = {
    read: false,
    note: 'Não reconheci o placar nesse print. Envie o print da janela do cliente na aba "Placar" (tela de fim de partida ou detalhe da partida no histórico), ou preencha abaixo.',
    rows: emptyRows(players),
  }
  try {
    const image = sharp(imageData)
    const meta = await image.metadata()
    if (!meta.width || !meta.height) return notStandard
    const size = { width: meta.width, height: meta.height }
    const list = await championList().catch(() => [] as { id: string; name: string }[])

    // Cada linha lida: nick e os números (o campeão já sai como id do Data Dragon).
    const lines: { nick: string; champion: string | null; kda: [number, number, number] | null; cs: number | null; gold: number | null; damage: number | null }[] = []
    let layout: 'end' | 'history'

    const grid = await findGrid(image)
    if (grid) {
      layout = 'end'
      for (const top of grid.rowTops) {
        const origin = { x: grid.barX, y: top, scale: grid.scale }
        const champ = await readBox(image, size, origin, BOX.champ, LETTERS)
        lines.push({
          nick: await readBox(image, size, origin, BOX.nick, LETTERS),
          champion: list.length ? matchChampion(champ, list) : null,
          kda: parseKda(await readBox(image, size, origin, BOX.kda, '0123456789/'), await readBox(image, size, origin, BOX.ratio, '0123456789,')),
          cs: null,
          damage: parseNumber(await readBox(image, size, origin, BOX.damage, '0123456789.')),
          gold: parseNumber(await readBox(image, size, origin, BOX.gold, '0123456789.')),
        })
      }
    } else {
      const { headers } = await findTeamHeaders(image, size)
      if (headers.length < 2) return notStandard
      const [first, secondHeader] = [headers[0], headers[headers.length - 1]]
      const scale = (secondHeader.y - first.y) / HISTORY.teamGap
      if (scale < 0.4 || scale > 4) return notStandard
      layout = 'history'
      for (const header of [first, secondHeader]) {
        for (let k = 0; k < 5; k++) {
          const origin = { x: header.x, y: header.y + (HISTORY.firstRow + HISTORY.pitch * k) * scale, scale }
          const icon = HISTORY.icon
          lines.push({
            nick: await readBox(image, size, origin, HISTORY.nick, LETTERS),
            champion: await matchIcon(image, size, origin.x + icon.dx * scale, origin.y + icon.dy * scale, icon.r * scale).catch(() => null),
            kda: await readSpacedKda(image, size, origin, HISTORY.kda),
            cs: parseNumber(await readBox(image, size, origin, HISTORY.cs, '0123456789')),
            damage: null,
            gold: parseNumber(await readBox(image, size, origin, HISTORY.gold, '0123456789.')),
          })
        }
      }
    }

    const owners = assignPlayers(
      lines.map((l) => l.nick),
      players,
    )
    const rows = emptyRows(players)
    lines.forEach((line, i) => {
      const owner = owners[i]
      if (!owner) return
      const row = rows.find((r) => r.userId === owner.userId)!
      row.champion = line.champion
      row.kills = line.kda?.[0] ?? null
      row.deaths = line.kda?.[1] ?? null
      row.assists = line.kda?.[2] ?? null
      row.cs = line.cs
      row.damage = line.damage
      row.gold = line.gold
    })
    const filled = rows.filter((r) => r.champion && r.kills !== null).length
    const missing = layout === 'end' ? 'O farm (CS) não aparece nessa tela.' : 'O dano não aparece nessa tela.'
    return {
      read: filled > 0,
      note:
        filled === players.length
          ? `Confira os números lidos do print antes de confirmar. ${missing}`
          : `Li ${filled} de ${players.length} jogadores. Confira e complete o que faltou. ${missing}`,
      rows,
    }
  } catch (err) {
    console.error('Falha ao ler o print do placar:', err)
    return { ...notStandard, note: 'Não consegui ler o print. Preencha os dados abaixo.' }
  }
}
