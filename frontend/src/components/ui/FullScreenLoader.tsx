import { BrandMark } from './icons'

// Tela de carregamento enquanto a sessão é validada.
export default function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center" role="status">
      <div className="flex flex-col items-center gap-3">
        <BrandMark className="h-12 w-[58px] animate-pulse" />
        <span className="font-display text-gold-200">Carregando...</span>
      </div>
    </div>
  )
}
