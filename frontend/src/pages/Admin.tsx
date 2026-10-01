import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import AdminLive from '../components/admin/AdminLive'
import AdminMatches from '../components/admin/AdminMatches'
import AdminUsers from '../components/admin/AdminUsers'
import { useAuth } from '../context/AuthContext'

type Section = 'live' | 'matches' | 'users'

const sections: { id: Section; label: string; description: string }[] = [
  { id: 'live', label: 'Ao vivo', description: 'Fila, confirmações de partida e lobbies abertos agora.' },
  { id: 'matches', label: 'Partidas', description: 'Histórico salvo: corrigir o resultado ou apagar uma partida.' },
  { id: 'users', label: 'Jogadores', description: 'Contas cadastradas: redefinir senha e acesso de admin.' },
]

export default function Admin() {
  const { user } = useAuth()
  const [section, setSection] = useState<Section>('live')

  // O backend também bloqueia; aqui só evita mostrar a tela para quem não é admin.
  if (!user?.isAdmin) return <Navigate to="/" replace />

  const current = sections.find((s) => s.id === section)!

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-gold-50">Admin</h1>
        <p className="mt-1 text-sm text-ash">{current.description}</p>
      </div>

      <div role="tablist" aria-label="Seções do admin" className="flex gap-1 border-b border-rim">
        {sections.map((s) => {
          const active = s.id === section
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(s.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                active ? 'border-gold-200 text-gold-50' : 'border-transparent text-ash hover:text-gold-50'
              }`}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel">
        {section === 'live' && <AdminLive />}
        {section === 'matches' && <AdminMatches />}
        {section === 'users' && <AdminUsers />}
      </div>
    </div>
  )
}
