import { useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  return (
    <AuthForm
      title="Criar conta"
      subtitle="Cadastre-se com seu Riot ID"
      submitLabel="Cadastrar"
      footerText="Já tem conta?"
      footerLinkLabel="Entrar"
      footerLinkTo="/login"
      confirmPassword
      validateRiotId
      onSubmit={async (riotId, password) => {
        await register(riotId, password)
        navigate('/', { replace: true })
      }}
    />
  )
}
