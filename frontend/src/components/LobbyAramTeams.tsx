import type { LobbySnapshot } from '../hooks/useLobby'
import { teamMembers } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import TeamCard from './TeamCard'
import WinChanceBar from './WinChanceBar'
import SectionTitle from './ui/SectionTitle'

// ARAM: sem capitães nem draft. Os times já vêm sorteados (equilibrados pela tabela de ARAM) e a partida
// começa sozinha quando o tempo acaba.
export default function LobbyAramTeams({ lobby, skew }: { lobby: LobbySnapshot; skew: number }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Times sorteados">
        Sorteio equilibrado pela tabela de ARAM. Quem está mais acima na tabela fica dividido entre os dois lados.
      </SectionTitle>

      <PhaseTimer endsAt={lobby.endsAt} durationMs={lobby.durationMs} skew={skew} label="A partida começa em instantes" />

      <WinChanceBar lobby={lobby} />

      <div className="grid items-start gap-3 md:grid-cols-[1fr_auto_1fr]">
        <TeamCard side="blue" members={teamMembers(lobby, 'blue')} hideRoles />
        <span className="hidden self-center font-display text-3xl text-gold-500 md:block">vs</span>
        <TeamCard side="red" members={teamMembers(lobby, 'red')} hideRoles />
      </div>
    </div>
  )
}
