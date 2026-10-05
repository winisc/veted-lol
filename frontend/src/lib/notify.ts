// Notificação do navegador para "partida encontrada": avisa mesmo com o jogador em outra aba ou janela.
// A preferência (ligada por padrão) fica no navegador, como o volume do som.
const PREF_KEY = 'queue-notify'

export type NotifyState = 'unsupported' | 'denied' | 'default' | 'granted'

export function notifyState(): NotifyState {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export function notifyEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setNotifyEnabled(enabled: boolean) {
  try {
    localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off')
  } catch {
    // sem armazenamento: vale só até recarregar
  }
}

// Pede a permissão (precisa vir de um clique). Devolve o estado depois do pedido.
export async function requestNotifyPermission(): Promise<NotifyState> {
  if (notifyState() !== 'default') return notifyState()
  try {
    await Notification.requestPermission()
  } catch {
    // navegadores antigos usam callback; nesse caso segue sem notificação
  }
  return notifyState()
}

// Ao entrar na fila: se a pessoa ainda não decidiu, é a hora natural de perguntar.
export function askPermissionOnJoin() {
  if (notifyEnabled() && notifyState() === 'default') void requestNotifyPermission()
}

// Só avisa quando a página não está à vista (se estiver, o popup e o som já bastam).
export function showMatchFound(body: string): Notification | null {
  if (!notifyEnabled() || notifyState() !== 'granted') return null
  if (document.visibilityState === 'visible' && document.hasFocus()) return null
  try {
    const notification = new Notification('Partida encontrada!', {
      body,
      tag: 'match-found', // uma só por vez: a nova substitui a antiga
      icon: '/favicon.svg',
      requireInteraction: true,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return notification
  } catch {
    return null
  }
}
