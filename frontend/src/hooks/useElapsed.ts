import { useEffect, useState } from 'react'

// Segundos desde `startedAt`, no relógio do servidor. Para de contar quando `endedAt` existe.
export function useElapsed(startedAt: number | null, skew: number, endedAt: number | null = null) {
  const calc = () => {
    if (startedAt === null) return 0
    const end = endedAt ?? Date.now() + skew
    return Math.max(0, (end - startedAt) / 1000)
  }
  const [seconds, setSeconds] = useState(calc)

  useEffect(() => {
    setSeconds(calc())
    if (endedAt !== null) return
    const timer = setInterval(() => setSeconds(calc()), 500)
    return () => clearInterval(timer)
  }, [startedAt, skew, endedAt])

  return seconds
}
