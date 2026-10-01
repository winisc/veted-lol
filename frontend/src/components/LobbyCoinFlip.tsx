import { useEffect, useState } from 'react'
import type { LobbySnapshot } from '../hooks/useLobby'
import { short, splitRiotId } from '../lib/teams'
import { CrownIcon } from './ui/icons'
import SectionTitle from './ui/SectionTitle'
import SummonerIcon from './ui/SummonerIcon'

const SPIN_MS = 2200

// O servidor já sorteou; aqui só animamos a moeda e revelamos o resultado.
export default function LobbyCoinFlip({ lobby, skew }: { lobby: LobbySnapshot; skew: number }) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    // Quem reconecta no meio da fase não precisa ver a moeda girar de novo do zero.
    const elapsed = lobby.endsAt ? lobby.durationMs - (lobby.endsAt - (Date.now() + skew)) : SPIN_MS
    const timer = setTimeout(() => setRevealed(true), Math.max(0, SPIN_MS - elapsed))
    return () => clearTimeout(timer)
  }, [])

  const byId = (id: number | null) => lobby.players.find((p) => p.id === id)
  const winner = byId(lobby.draft.firstPickId)
  const loser = byId(lobby.draft.sideChooserId)
  const captains = lobby.captains.map(byId).filter((p): p is NonNullable<typeof p> => Boolean(p))

  return (
    <div className="space-y-5">
      <SectionTitle title="Sorteio entre os capitães">Quem vencer escolhe primeiro. Quem perder escolhe o lado.</SectionTitle>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {captains.map((c, i) => {
          const won = revealed && c.id === winner?.id
          const lost = revealed && !won
          const [name, tag] = splitRiotId(c.riotId)
          const card = (
            <div
              key={c.id}
              className={`flex min-w-0 flex-col items-center gap-3 text-center transition duration-500 ${lost ? 'opacity-40 grayscale' : ''}`}
            >
              <SummonerIcon iconId={c.iconId} size="lg" ring={won ? 'gold' : 'dim'} glow={won} />
              <div className="min-w-0">
                <p className="truncate font-display text-xl text-gold-50">{name}</p>
                <p className="text-sm text-ash">#{tag}</p>
              </div>
            </div>
          )
          if (i === 0) return card
          return [
            <div
              key="coin"
              className={`grid h-20 w-20 place-items-center rounded-full bg-gold-200 text-void ${
                revealed ? '' : 'coin-spin'
              }`}
              aria-hidden="true"
            >
              {revealed ? <CrownIcon className="h-10 w-10" /> : <span className="font-display text-4xl">?</span>}
            </div>,
            card,
          ]
        })}
      </div>

      <div className="min-h-16 text-center" aria-live="polite">
        {revealed ? (
          <>
            <p className="font-display text-2xl text-gold-200">{short(winner)} venceu o sorteio</p>
            <p className="mt-1 text-ash">Escolhe primeiro no draft. {short(loser)} escolhe o lado.</p>
          </>
        ) : (
          <p className="text-ash">Sorteando...</p>
        )}
      </div>
    </div>
  )
}
