import type { LobbySnapshot, Side } from '../hooks/useLobby'
import { short } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import SectionTitle from './ui/SectionTitle'
import SummonerIcon from './ui/SummonerIcon'

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onChoose: (side: Side) => void
}

const options: { side: Side; title: string; text: string; classes: string }[] = [
  {
    side: 'blue',
    title: 'Lado Azul',
    text: 'Base no canto inferior esquerdo do mapa.',
    classes: 'border-team-blue/40 bg-team-blue/10 text-team-blue hover:bg-team-blue/20',
  },
  {
    side: 'red',
    title: 'Lado Vermelho',
    text: 'Base no canto superior direito do mapa.',
    classes: 'border-team-red/40 bg-team-red/10 text-team-red hover:bg-team-red/20',
  },
]

export default function LobbySide({ lobby, skew, busy, onChoose }: Props) {
  const chooser = lobby.players.find((p) => p.id === lobby.draft.sideChooserId)
  const first = lobby.players.find((p) => p.id === lobby.draft.firstPickId)
  const isChooser = Boolean(chooser?.isYou)

  return (
    <div className="space-y-5">
      <SectionTitle title="Escolha de lado">
        {lobby.mode === 'ranked'
          ? `${short(first)} vai pickar primeiro. `
          : `${short(first)} venceu o sorteio e escolhe primeiro. `}
        {isChooser ? 'Você' : short(chooser)} escolhe o lado.
      </SectionTitle>

      <PhaseTimer endsAt={lobby.endsAt} durationMs={lobby.durationMs} skew={skew} label="Sem escolha, o lado é sorteado" />

      {isChooser ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((opt) => (
            <button
              key={opt.side}
              type="button"
              onClick={() => onChoose(opt.side)}
              disabled={busy}
              className={`rounded-xl border px-6 py-7 text-center transition-colors disabled:opacity-60 ${opt.classes}`}
            >
              <span className="block font-display text-3xl">{opt.title}</span>
              <span className="mt-2 block text-sm text-ash">{opt.text}</span>
            </button>
          ))}
        </div>
      ) : (
        chooser && (
          <div className="flex items-center justify-center gap-4 border border-rim bg-void/50 px-4 py-4">
            <SummonerIcon iconId={chooser.iconId} size="lg" ring="gold" />
            <p className="text-gold-50">
              <span className="font-display text-xl">{short(chooser)}</span>
              <span className="block text-sm text-ash">está escolhendo o lado...</span>
            </p>
          </div>
        )
      )}
    </div>
  )
}
