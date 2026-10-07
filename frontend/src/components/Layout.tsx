import { useEffect, useRef, type ComponentType } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { QueueProvider, useQueue } from '../context/QueueContext'
import { splitRiotId } from '../lib/teams'
import { BrandMark, LogoutIcon, ShieldIcon, SwordsIcon, TrophyIcon, UserIcon } from './ui/icons'
import SummonerIcon from './ui/SummonerIcon'
import Notice from './ui/Notice'
import DroppedToast from './DroppedToast'
import ReadyCheckModal from './ReadyCheckModal'
import SettingsModal from './SettingsModal'
import RolesRequiredModal from './RolesRequiredModal'
import { queueModes } from '../lib/modes'

interface Tab {
  to: string
  label: string
  Icon: ComponentType<{ className?: string }>
  isActive: (path: string) => boolean
}

const tabs: Tab[] = [
  { to: '/', label: 'Jogar', Icon: SwordsIcon, isActive: (p) => p === '/' || p.startsWith('/lobby') },
  { to: '/perfil', label: 'Perfil', Icon: UserIcon, isActive: (p) => p.startsWith('/perfil') },
  { to: '/tabela', label: 'Tabela', Icon: TrophyIcon, isActive: (p) => p.startsWith('/tabela') },
]

const adminTab: Tab = { to: '/admin', label: 'Admin', Icon: ShieldIcon, isActive: (p) => p.startsWith('/admin') }

// Status da fila sempre à vista enquanto o jogador navega.
function QueueStatus({ compact }: { compact?: boolean }) {
  const { snapshot } = useQueue()

  if (snapshot?.status === 'queued') {
    return (
      <Link
        to="/"
        className={`flex items-center gap-2 rounded-md border border-hex-300/30 bg-hex-300/10 text-hex-100 ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-2.5 text-sm'}`}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-hex-300" />
        <span className="font-semibold">Na fila{snapshot.mode && ` · ${queueModes[snapshot.mode].short}`}</span>
        <span className="ml-auto font-cond text-base font-bold tabular-nums">
          {snapshot.size}/{snapshot.required}
        </span>
      </Link>
    )
  }

  if (snapshot?.status === 'standby' && snapshot.standby) {
    return (
      <Link
        to="/"
        className={`flex items-center gap-2 rounded-md border border-rim bg-panel text-gold-50 ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-2.5 text-sm'}`}
      >
        <span className="h-2 w-2 rounded-full bg-ash" />
        <span className="font-semibold">Na espera{snapshot.mode && ` · ${queueModes[snapshot.mode].short}`}</span>
        <span className="ml-auto font-cond text-base font-bold tabular-nums">{snapshot.standby.position}º</span>
      </Link>
    )
  }

  if (snapshot?.status === 'ready_check') {
    return (
      <span
        className={`flex items-center gap-2 rounded-md border border-gold-200/30 bg-gold-200/10 text-gold-200 ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-2.5 text-sm'}`}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-gold-200" />
        <span className="font-semibold">Partida encontrada</span>
      </span>
    )
  }

  if (snapshot?.status === 'matched') {
    return (
      <Link
        to="/lobby"
        className={`flex items-center gap-2 rounded-md border border-gold-200/30 bg-gold-200/10 text-gold-200 ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-2.5 text-sm'}`}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-gold-200" />
        <span className="font-semibold">Em partida</span>
      </Link>
    )
  }

  return null
}

function LayoutContent() {
  const { user, logout } = useAuth()
  const { snapshot, notice, clearNotice } = useQueue()
  const visibleTabs = user?.isAdmin ? [...tabs, adminTab] : tabs
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [name, tag] = splitRiotId(user?.riotId ?? '')

  // A fila encheu: leva o jogador para o lobby de onde ele estiver (ex.: olhando a tabela).
  // Só reage à mudança para "matched"; quem sai do lobby e volta para a aba Jogar não é redirecionado.
  // Ao abrir o site já dentro de um lobby, só leva para ele se a página for o início: um perfil aberto em
  // outra aba (link do lobby) precisa continuar aberto.
  const previousStatus = useRef<string | undefined>(undefined)
  useEffect(() => {
    const status = snapshot?.status
    const firstLoad = previousStatus.current === undefined
    if (status === 'matched' && previousStatus.current !== 'matched' && pathname !== '/lobby' && (!firstLoad || pathname === '/')) {
      navigate('/lobby')
    }
    previousStatus.current = status
  }, [snapshot?.status, pathname, navigate])

  return (
    <div className="min-h-screen">
      {/* Barra lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-rim bg-abyss/95 lg:flex">
        <Link to="/" className="flex items-center gap-3 border-b border-rim px-5 py-5">
          <BrandMark className="h-8 w-10" />
          <span className="font-display text-2xl leading-none text-gold-50">
            <span className="sr-only">x5 </span>Veted
          </span>
        </Link>

        <nav className="flex flex-col gap-1 p-3" aria-label="Seções">
          {visibleTabs.map(({ to, label, Icon, isActive }) => {
            const active = isActive(pathname)
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-panel text-gold-50' : 'text-ash hover:bg-panel/60 hover:text-gold-50'
                }`}
              >
                {active && <span aria-hidden="true" className="absolute inset-y-1 left-0 w-0.5 bg-gold-200" />}
                <Icon className={`h-5 w-5 ${active ? 'text-gold-200' : ''}`} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3">
          <QueueStatus />
        </div>

        <div className="mt-auto border-t border-rim p-4">
          <div className="flex items-center gap-3">
            {user && <SummonerIcon iconId={user.iconId} size="md" ring="gold" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gold-50">{name}</p>
              <p className="truncate text-xs text-ash">#{tag}</p>
            </div>
            <SettingsModal />
            <button
              type="button"
              onClick={logout}
              title="Sair da conta"
              aria-label="Sair da conta"
              className="p-2 text-ash transition hover:text-team-red"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      {/* Topo (celular) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-rim bg-abyss/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark className="h-7 w-[34px]" />
          <span className="font-display text-xl text-gold-50">
            <span className="sr-only">x5 </span>Veted
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <QueueStatus compact />
          <SettingsModal />
          {user && <SummonerIcon iconId={user.iconId} size="xs" ring="gold" />}
          <button type="button" onClick={logout} aria-label="Sair da conta" className="p-1.5 text-ash hover:text-team-red">
            <LogoutIcon />
          </button>
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-8">
          {notice && (
            <div className="mb-4 flex items-start gap-2">
              <Notice tone="warning" className="flex-1">
                {notice}
              </Notice>
              <button
                type="button"
                onClick={clearNotice}
                aria-label="Fechar aviso"
                className="rounded-md px-2 py-1.5 text-ash transition-colors hover:bg-panel hover:text-gold-50"
              >
                ✕
              </button>
            </div>
          )}
          <Outlet />
        </div>
      </main>

      <ReadyCheckModal />
      <DroppedToast />
      <RolesRequiredModal />

      {/* Abas (celular) */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-30 grid ${visibleTabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} border-t border-rim bg-abyss/95 backdrop-blur lg:hidden`}
        aria-label="Seções"
      >
        {visibleTabs.map(({ to, label, Icon, isActive }) => {
          const active = isActive(pathname)
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${active ? 'text-gold-50' : 'text-ash'}`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-gold-200' : ''}`} />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default function Layout() {
  return (
    <QueueProvider>
      <LayoutContent />
    </QueueProvider>
  )
}
