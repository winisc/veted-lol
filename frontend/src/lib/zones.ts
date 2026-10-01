// Zonas do ranking (quem está em cada uma é decidido pelo backend). Aqui ficam nomes e cores.
// As classes aparecem completas para o Tailwind encontrá-las.
import type { IconRing } from '../components/ui/SummonerIcon'

export type Zone = 'top' | 'good' | 'basic' | 'carry' | 'bleed' | 'uninstall'

interface ZoneStyle {
  label: string
  symbol: string
  bar: string // barra lateral da linha
  row: string // fundo da linha
  header: string // faixa que abre a zona
  text: string // cor de destaque (posição, pontos)
  badge: string // etiqueta (legenda e perfil)
  ring: IconRing // anel do ícone de invocador
}

export const zoneOrder: Zone[] = ['top', 'good', 'basic', 'carry', 'bleed', 'uninstall']

export const zones: Record<Zone, ZoneStyle> = {
  // Ouro hextech: só o primeiro lugar.
  top: {
    label: 'O Melhor',
    symbol: '♛',
    bar: 'border-gold-200',
    row: 'bg-gold-200/[0.07]',
    header: 'bg-gold-200/10 text-gold-200',
    text: 'text-gold-200',
    badge: 'bg-gold-200 text-void',
    ring: 'gold',
  },
  // Verdes claros, do mais vivo ao mais suave.
  good: {
    label: 'Bom trabalho',
    symbol: '▲',
    bar: 'border-emerald-300',
    row: 'bg-emerald-400/[0.05]',
    header: 'bg-emerald-400/10 text-emerald-300',
    text: 'text-emerald-300',
    badge: 'bg-emerald-400/15 text-emerald-300',
    ring: 'dim',
  },
  basic: {
    label: 'Fez o básico',
    symbol: '●',
    bar: 'border-lime-300',
    row: 'bg-lime-300/[0.035]',
    header: 'bg-lime-300/[0.08] text-lime-200',
    text: 'text-lime-200',
    badge: 'bg-lime-300/10 text-lime-200',
    ring: 'dim',
  },
  carry: {
    label: 'Empena lobby',
    symbol: '▼',
    bar: 'border-lime-100/50',
    row: 'bg-transparent',
    header: 'bg-white/[0.04] text-lime-100/70',
    text: 'text-lime-100/70',
    badge: 'bg-white/[0.06] text-lime-100/70',
    ring: 'dim',
  },
  // Vermelhos: sangria é o alerta, desinstala é o fundo do poço.
  bleed: {
    label: 'Sangria',
    symbol: '✚',
    bar: 'border-red-400',
    row: 'bg-red-500/[0.06]',
    header: 'bg-red-500/10 text-red-300',
    text: 'text-red-300',
    badge: 'bg-red-500/15 text-red-300',
    ring: 'red',
  },
  uninstall: {
    label: 'Desinstala',
    symbol: '✖',
    bar: 'border-red-500',
    row: 'bg-red-600/[0.14]',
    header: 'bg-red-600/25 text-red-200',
    text: 'text-red-300',
    badge: 'bg-red-600/90 text-white',
    ring: 'red',
  },
}
