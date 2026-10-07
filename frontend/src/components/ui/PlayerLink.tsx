import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// Caminho do perfil de um jogador (o próprio perfil continua em /perfil).
export function useProfilePath() {
  const { user } = useAuth()
  return (userId: number) => (userId === user?.id ? '/perfil' : `/jogador/${userId}`)
}

// Nome de jogador que leva ao perfil dele.
export default function PlayerLink({
  userId,
  children,
  className = '',
  newTab = false,
}: {
  userId: number
  children: ReactNode
  className?: string
  newTab?: boolean // abre em outra aba (no lobby, para não sair da partida)
}) {
  const path = useProfilePath()
  return (
    <Link
      to={path(userId)}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`hover:text-gold-200 hover:underline ${className}`}
    >
      {children}
    </Link>
  )
}
