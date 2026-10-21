import type { LobbySnapshot, PlayerGameStats } from '../hooks/useLobby'
import { splitRiotId, teamMembers } from '../lib/teams'
import StatsUploader from './StatsUploader'
import SectionTitle from './ui/SectionTitle'
import SummonerIcon from './ui/SummonerIcon'

interface Props {
  lobby: LobbySnapshot
  busy: boolean
  onSubmit: (rows: PlayerGameStats[]) => void
  onSkip: () => void
}

// Passo do print da pancada (5x5): o capitão do time vencedor envia o print do placar, confere o campeão e o KDA lidos
// (corrige ou preenche o que faltar) e confirma. Ele também pode pular. Os outros só aguardam.
export default function LobbyStats({ lobby, busy, onSubmit, onSkip }: Props) {
  const uploader = lobby.players.find((p) => p.id === lobby.match.statsUploaderId)

  if (!uploader?.isYou) {
    return (
      <div className="space-y-5">
        <SectionTitle title="Print da pancada">O capitão do time vencedor envia o print do fim da partida.</SectionTitle>
        {uploader && (
          <div className="flex items-center justify-center gap-4 border border-rim bg-void/50 px-4 py-4">
            <SummonerIcon iconId={uploader.iconId} size="lg" ring="gold" />
            <p className="text-gold-50">
              <span className="font-display text-xl">{splitRiotId(uploader.riotId)[0]}</span>
              <span className="block text-sm text-ash">está enviando o print da pancada...</span>
            </p>
          </div>
        )}
      </div>
    )
  }

  const players = (['blue', 'red'] as const).flatMap((side) =>
    teamMembers(lobby, side).map((p) => ({ id: p.id, riotId: p.riotId, side })),
  )
  return (
    <StatsUploader
      players={players}
      uploadPath="/lobby/stats/screenshot"
      intro={
        <SectionTitle title="Print da pancada">
          Você é o capitão vencedor: envie o print do placar da partida (com os 10 jogadores). O site lê o campeão e o
          KDA de cada um, e você confere antes de salvar.
        </SectionTitle>
      }
      submitLabel="Confirmar e seguir"
      busy={busy}
      onSubmit={onSubmit}
      onSkip={onSkip}
    />
  )
}
