import type { LobbySnapshot } from '../hooks/useLobby'
import { teamMembers } from '../lib/teams'
import { winChance } from '../lib/winChance'

// Barra com a chance estimada de vitória de cada time (pelo elo e pela tabela). No draft, muda a cada pick.
export default function WinChanceBar({ lobby }: { lobby: LobbySnapshot }) {
  const blue = teamMembers(lobby, 'blue')
  const red = teamMembers(lobby, 'red')
  if (blue.length === 0 || red.length === 0) return null

  const { blue: chance, informed } = winChance(blue, red)
  const bluePct = Math.round(chance * 100)
  const redPct = 100 - bluePct

  return (
    <div
      className="mx-auto w-full max-w-xl"
      title="Estimativa pela força média de cada time: metade pelo elo do LoL, metade pelos pontos na tabela da season. Não é previsão garantida."
    >
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-cond text-base font-bold tabular-nums text-team-blue">{bluePct}%</span>
        <span className="text-ash">{informed ? 'Chance estimada de vitória' : 'Chance estimada (sem elo nem tabela ainda)'}</span>
        <span className="font-cond text-base font-bold tabular-nums text-team-red">{redPct}%</span>
      </div>
      <div
        role="img"
        aria-label={`Chance estimada: azul ${bluePct}%, vermelho ${redPct}%`}
        className="flex h-2 overflow-hidden rounded-full bg-rim"
      >
        <div className="h-full bg-team-blue transition-[width] duration-700 ease-out" style={{ width: `${bluePct}%` }} />
        <div className="h-full flex-1 bg-team-red" />
      </div>
    </div>
  )
}
