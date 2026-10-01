import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

// Carrega um GET da API quando a página abre. `reload()` busca de novo (ex.: depois de uma ação).
// Com `refreshMs`, recarrega sozinho nesse intervalo (ex.: painel ao vivo).
export function useApi<T>(path: string, refreshMs?: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    if (version === 0) setLoading(true)

    api<T>(path)
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError('')
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro inesperado.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [path, version])

  useEffect(() => {
    if (!refreshMs) return
    const timer = setInterval(reload, refreshMs)
    return () => clearInterval(timer)
  }, [refreshMs, reload])

  return { data, error, loading, reload }
}
