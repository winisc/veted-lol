// Ícones de linha simples (SVG inline), herdam a cor do texto.
interface Props {
  className?: string
}

const base = 'shrink-0'

export function SwordsIcon({ className = 'h-5 w-5' }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={`${base} ${className}`} aria-hidden="true">
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2" />
      <path d="M9.5 6.5 13 3h3v3l-3.5 3.5M5 14l-2 2 4 4 2-2M3 21l2-2" />
    </svg>
  )
}

export function UserIcon({ className = 'h-5 w-5' }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={`${base} ${className}`} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  )
}

export function TrophyIcon({ className = 'h-5 w-5' }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={`${base} ${className}`} aria-hidden="true">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6" />
    </svg>
  )
}

export function LogoutIcon({ className = 'h-5 w-5' }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={`${base} ${className}`} aria-hidden="true">
      <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />
    </svg>
  )
}

export function ShieldIcon({ className = 'h-5 w-5' }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={`${base} ${className}`} aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function CrownIcon({ className = 'h-4 w-4' }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`} aria-hidden="true">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" />
    </svg>
  )
}

export function StarIcon({ className = 'h-4 w-4' }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`} aria-hidden="true">
      <path d="m12 2.5 2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7L12 2.5Z" />
    </svg>
  )
}

export function CheckIcon({ className = 'h-3.5 w-3.5' }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`${base} ${className}`} aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  )
}

// Marca do app: monograma "X5" angular e inclinado — X no ouro de acento, 5 em branco, sem caixa em volta.
// Proporção 6:5 (use largura e altura, ex.: "h-8 w-10"). Ao lado dela vai só o texto "Veted" (lê-se "X5 Veted").
// A mesma forma está em public/favicon.svg (lá sobre um quadrado escuro, para aparecer em abas claras).
export function BrandMark({ className = 'h-8 w-10' }: Props) {
  return (
    <svg viewBox="0 0 48 40" className={`${base} ${className}`} aria-hidden="true">
      <g transform="skewX(-12) translate(4 0)">
        <path d="M2 4h7.5l6 11 6-11H29l-9.6 16L29 36h-7.5l-6-11-6 11H2l9.6-16z" fill="#C9A96A" />
        <path
          d="M31 4h15v6h-9.4l-.6 5.2c1.2-.5 2.4-.7 3.6-.7 5 0 8.4 3.4 8.4 8.5 0 5.6-4 9.4-9.8 9.4-3.4 0-6.4-1.2-8.4-3.2l3.2-4.6c1.4 1.3 3.2 2.1 5 2.1 2.6 0 4.2-1.5 4.2-3.8s-1.6-3.6-4-3.6c-1.4 0-2.6.4-3.8 1.2L30 18.6z"
          fill="#F2F3F5"
        />
      </g>
    </svg>
  )
}
