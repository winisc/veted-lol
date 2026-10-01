import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import FullScreenLoader from './ui/FullScreenLoader'

export default function GuestRoute() {
  const { user, loading } = useAuth()

  if (loading) return <FullScreenLoader />
  return user ? <Navigate to="/" replace /> : <Outlet />
}
