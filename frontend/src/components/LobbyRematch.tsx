import type { LobbySnapshot, Side } from '../hooks/useLobby'
import { sideStyle, teamMembers } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import TeamCard from './TeamCard'
import SectionTitle from './ui/SectionTitle'

// Contagem antes da revanche. Os lados ainda não trocaram no servidor; aqui mostramos como vai ficar.
export default function LobbyRematch({ lobby, skew }: { lobby: LobbySnapshot; skew: number }) {
  const me = lobby.players.find((p) => p.isYou)
  const mySideNow = me?.team
  const mySideNext: Side | null = mySideNow === 'blue' ? 'red' : mySideNow === 'red' ? 'blue' : null

  return (
    <div className="space-y-4">
      <SectionTitle title="Revanche: os times trocam de lado">
        {mySideNow && mySideNext && (
          <>
            Você sai do <span className={sideStyle[mySideNow].text}>{sideStyle[mySideNow].name}</span> e vai para o{' '}
            <span className={sideStyle[mySideNext].text}>{sideStyle[mySideNext].name}</span>.
          </>
        )}
      </SectionTitle>

      <PhaseTimer endsAt={lobby.endsAt} durationMs={lobby.durationMs} skew={skew} label="A partida começa em instantes" />

      {/* Cada card mostra o time que ficará naquele lado: azul = quem era vermelho e vice-versa. */}
      <div className="grid gap-4 md:grid-cols-2">
        {(['blue', 'red'] as Side[]).map((side) => (
          <TeamCard
            key={side}
            side={side}
            title={`${sideStyle[side].name} (antes ${side === 'blue' ? 'vermelho' : 'azul'})`}
            members={teamMembers(lobby, side === 'blue' ? 'red' : 'blue')}
          />
        ))}
      </div>
    </div>
  )
}
