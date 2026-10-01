import { HexLink } from '../components/ui/HexButton'
import { pageSplash } from '../lib/ddragon'

export default function NotFound() {
  return (
    <div className="relative isolate grid min-h-screen place-items-center overflow-hidden px-4 text-center">
      <img src={pageSplash.notFound} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-void via-void/80 to-void/40" />
      <div>
        <p className="font-cond text-8xl font-bold leading-none text-gold-200">404</p>
        <h1 className="mt-3 font-display text-3xl text-gold-50">Essa rota não existe no mapa</h1>
        <p className="mt-2 text-ash">O link pode estar errado ou a página foi removida.</p>
        <HexLink to="/" className="mt-8">
          Voltar ao início
        </HexLink>
      </div>
    </div>
  )
}
