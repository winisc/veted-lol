import type { LobbySnapshot, Side } from '../hooks/useLobby'
import { short, sideStyle, teamMembers } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import TeamCard from './TeamCard'
import { YouBadge } from './ui/Badges'
import PlayerRow from './ui/PlayerRow'
import SummonerIcon from './ui/SummonerIcon'

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onPick: (playerId: number) => void
}

const TEAM_SIZE = 5

// Tela no formato da seleção de campeões: Time Azul | jogadores disponíveis | Time Vermelho.
export default function LobbyDraft({ lobby, skew, busy, onPick }: Props) {
  const { draft } = lobby
  const me = lobby.players.find((p) => p.isYou)
  const byId = (id: number | null) => lobby.players.find((p) => p.id === id)

  const picking = lobby.phase === 'picking'
  const myTurn = picking && draft.currentTurnId === me?.id
  const observer = !me?.isCaptain
  const turnPlayer = byId(draft.currentTurnId)
  const turnSide: Side | null = turnPlayer?.team ?? null
  const pool = lobby.players.filter((p) => p.team === null)
  const picksWord = draft.turnPicksLeft === 1 ? 'jogador' : 'jogadores'

  return (
    <div className="space-y-4">
      {/* Vez de quem + timer na mesma faixa */}
      <div className="grid items-center gap-3 md:grid-cols-[1fr_1fr]">
        <div
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
            lobby.phase === 'done'
              ? 'border-gold-200/60 bg-gold-700/30'
              : turnSide
                ? `${sideStyle[turnSide].border} ${sideStyle[turnSide].bg}`
                : 'border-rim'
          }`}
          aria-live="polite"
        >
          {lobby.phase === 'done' ? (
            <div>
              <p className="font-display text-xl text-gold-50">Times formados</p>
              <p className="text-sm text-ash">A partida começa em instantes. Boa sorte, invocadores.</p>
            </div>
          ) : (
            <>
              {turnPlayer && (
                <SummonerIcon iconId={turnPlayer.iconId} size="md" ring={turnSide ? sideStyle[turnSide].ring : 'gold'} />
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-xl text-gold-50">
                  {myTurn ? (
                    `Sua vez: escolha ${draft.turnPicksLeft} ${picksWord}`
                  ) : (
                    <>
                      Vez de <span className={turnSide ? sideStyle[turnSide].text : ''}>{short(turnPlayer)}</span>
                    </>
                  )}
                </p>
                <p className="truncate text-sm text-ash">
                  Pick {Math.min(draft.pickIndex + 1, draft.totalPicks)} de {draft.totalPicks}
                  {!myTurn && ` · escolhe ${draft.turnPicksLeft} ${picksWord}`}
                  {observer && ' · você está observando'}
                </p>
              </div>
            </>
          )}
        </div>
        <PhaseTimer
          endsAt={lobby.endsAt}
          durationMs={lobby.durationMs}
          skew={skew}
          label={picking ? 'Sem escolha, um jogador aleatório é sorteado' : undefined}
        />
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[1fr_1.1fr_1fr]">
        <TeamCard side="blue" members={teamMembers(lobby, 'blue')} slots={TEAM_SIZE} />

        <div className="order-first space-y-3 lg:order-0">
          {pool.length > 0 && (
            <div>
              <h3 className="mb-1.5 font-display text-lg text-gold-50">
                Disponíveis <span className="font-cond text-base text-ash">({pool.length})</span>
              </h3>
              <ul className="grid grid-cols-2 gap-1">
                {pool.map((player) => (
                  <li key={player.id}>
                    <PlayerRow
                      riotId={player.riotId}
                      iconId={player.iconId}
                      ring={myTurn ? 'gold' : 'dim'}
                      onClick={myTurn ? () => onPick(player.id) : undefined}
                      disabled={busy}
                      highlight={player.isYou}
                      badges={player.isYou && <YouBadge />}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.picks.length > 0 && (
            <div>
              <h3 className="mb-1 font-display text-base text-gold-50">Histórico de picks</h3>
              <ol className="max-h-32 overflow-y-auto pr-1 text-sm">
                {[...draft.picks].reverse().map((pk) => {
                  const captain = byId(pk.byId)
                  const picked = byId(pk.playerId)
                  return (
                    <li key={pk.order} className="flex items-center gap-2 border-b border-rim/60 py-1 text-ash">
                      <span className="w-5 text-right font-cond font-semibold text-ash-dim">{pk.order}</span>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${captain?.team === 'blue' ? 'bg-team-blue' : 'bg-team-red'}`} />
                      <span className="min-w-0 truncate">
                        <span className="text-gold-50">{short(captain)}</span> escolheu{' '}
                        <span className="text-gold-50">{short(picked)}</span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </div>

        <TeamCard side="red" members={teamMembers(lobby, 'red')} slots={TEAM_SIZE} />
      </div>
    </div>
  )
}
