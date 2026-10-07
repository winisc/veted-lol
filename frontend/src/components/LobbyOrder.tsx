import type { LobbySnapshot } from '../hooks/useLobby'
import { short } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import SectionTitle from './ui/SectionTitle'
import SummonerIcon from './ui/SummonerIcon'

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onChoose: (first: boolean) => void
}

const options: { first: boolean; title: string; text: string; classes: string }[] = [
  {
    first: true,
    title: 'Pickar primeiro',
    text: 'Você escolhe o primeiro jogador. O outro capitão escolhe o lado.',
    classes: 'border-gold-200/40 bg-gold-200/10 text-gold-200 hover:bg-gold-200/20',
  },
  {
    first: false,
    title: 'Pickar segundo',
    text: 'O outro capitão pica primeiro. Você escolhe o lado.',
    classes: 'border-hex-300/40 bg-hex-300/10 text-hex-300 hover:bg-hex-300/20',
  },
]

// Modo tabela: no lugar do sorteio, o capitão em 2º na tabela escolhe se pica primeiro ou segundo.
export default function LobbyOrder({ lobby, skew, busy, onChoose }: Props) {
  const chooser = lobby.players.find((p) => p.id === lobby.draft.orderChooserId)
  const other = lobby.players.find((p) => lobby.captains.includes(p.id) && p.id !== chooser?.id)
  const isChooser = Boolean(chooser?.isYou)

  return (
    <div className="space-y-5">
      <SectionTitle title="Quem pica primeiro?">
        {isChooser ? 'Você' : short(chooser)} está em 2º na tabela entre os capitães e escolhe a ordem dos picks.
        {other ? ` ${short(other)} fica com a outra opção.` : ''} Quem pica por último escolhe o lado.
      </SectionTitle>

      <PhaseTimer endsAt={lobby.endsAt} durationMs={lobby.durationMs} skew={skew} label="Sem escolha, a ordem é sorteada" />

      {isChooser ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((opt) => (
            <button
              key={opt.title}
              type="button"
              onClick={() => onChoose(opt.first)}
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
              <span className="block text-sm text-ash">está escolhendo se pica primeiro ou segundo...</span>
            </p>
          </div>
        )
      )}
    </div>
  )
}
