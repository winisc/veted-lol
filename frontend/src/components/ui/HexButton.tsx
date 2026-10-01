import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

export type HexVariant = 'primary' | 'secondary' | 'danger'
export type HexSize = 'sm' | 'md' | 'lg'

// Botão chapado: primário em ouro sólido, secundário neutro com borda.
// (O nome "Hex" ficou da versão anterior; mantido para não mexer em todos os usos.)
const variants: Record<HexVariant, string> = {
  primary: 'bg-gold-200 text-void hover:bg-[#d6b97f] active:bg-gold-300',
  secondary: 'border border-rim bg-panel text-gold-50 hover:border-ash-dim hover:bg-rim',
  danger: 'bg-team-red text-white hover:bg-[#ec5f63]',
}

const sizes: Record<HexSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
}

export function hexClasses(variant: HexVariant = 'primary', size: HexSize = 'md') {
  return {
    outer: `inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ${variants[variant]} ${sizes[size]}`,
    inner: 'contents',
  }
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: HexVariant
  size?: HexSize
  children: ReactNode
  ref?: Ref<HTMLButtonElement> // React 19: ref chega como prop comum (ex.: foco no modal)
}

export default function HexButton({ variant, size, children, className = '', ref, ...rest }: ButtonProps) {
  const c = hexClasses(variant, size)
  return (
    <button {...rest} ref={ref} className={`${c.outer} ${className}`}>
      {children}
    </button>
  )
}

interface LinkButtonProps extends LinkProps {
  variant?: HexVariant
  size?: HexSize
}

export function HexLink({ variant, size, children, className = '', ...rest }: LinkButtonProps) {
  const c = hexClasses(variant, size)
  return (
    <Link {...rest} className={`${c.outer} ${className}`}>
      {children}
    </Link>
  )
}
