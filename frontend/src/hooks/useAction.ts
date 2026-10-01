import { useCallback, useState } from 'react'

export interface ActionMessage {
  tone: 'info' | 'error'
  text: string
}

// Executa uma ação (chamada à API) mostrando "ocupado" e uma mensagem de sucesso ou erro.
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<ActionMessage | null>(null)

  const run = useCallback(async (action: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage({ tone: 'info', text: success })
      after?.()
      return true
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Erro inesperado.' })
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const clear = useCallback(() => setMessage(null), [])

  return { busy, message, run, clear }
}
