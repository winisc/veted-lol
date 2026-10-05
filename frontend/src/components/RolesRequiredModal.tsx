import { useNavigate } from 'react-router-dom'
import { useQueue } from '../context/QueueContext'
import { roleInfo, roleOrder } from '../lib/roles'
import ConfirmDialog from './ui/ConfirmDialog'

// Aparece quando o jogador tenta entrar na fila sem as 3 roles salvas no perfil.
export default function RolesRequiredModal() {
  const { rolesRequired, dismissRolesRequired } = useQueue()
  const navigate = useNavigate()

  return (
    <ConfirmDialog
      open={rolesRequired}
      title="Defina suas roles primeiro"
      confirmLabel="Ir para o perfil"
      cancelLabel="Agora não"
      onConfirm={() => {
        dismissRolesRequired()
        navigate('/perfil?tour=roles') // o perfil destaca onde definir as roles
      }}
      onCancel={dismissRolesRequired}
    >
      <div className="flex justify-center gap-2" aria-hidden="true">
        {roleOrder.map((role) => (
          <img key={role} src={roleInfo[role].icon} alt="" className="h-7 w-7 opacity-70" />
        ))}
      </div>
      <p className="mt-3 text-sm text-ash">
        Para entrar na fila, escolha no seu perfil a <span className="font-semibold text-gold-50">role principal</span>, a{' '}
        <span className="font-semibold text-gold-50">secundária</span> e a que você{' '}
        <span className="font-semibold text-gold-50">empena o lobby</span>.
      </p>
    </ConfirmDialog>
  )
}
