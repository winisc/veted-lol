import type { LobbySnapshot, Side } from '../hooks/useLobby'
import { short, sideStyle, teamMembers } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import HexButton from './ui/HexButton'
import TeamCard from './TeamCard'
import { YouBadge } from './ui/Badges'
import { ReactionBubble } from './Reactions'
import WinChanceBar from './WinChanceBar'
import PlayerRow from './ui/PlayerRow'
import RankBadge from './ui/RankBadge'
import StreakBadge from './ui/StreakBadge'
import EloBadge from './ui/EloBadge'
import RoleIcons from './ui/RoleIcons'
import SummonerIcon from './ui/SummonerIcon'

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onPick: (playerId: number) => void
  onConfirm: () => void // capitão confirma os times formados (vai para os bans)
}

const TEAM_SIZE = 5

// Tela no formato da seleção de campeões: Time Azul | jogadores disponíveis | Time Vermelho.
export default function LobbyDraft({ lobby, skew, busy, onPick, onConfirm }: Props) {
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
  // Times formados: os dois capitães confirmam para ir aos bans.
  const confirmed = draft.confirmedIds ?? []
  const captains = lobby.captains.map((id) => byId(id)).filter((p): p is NonNullable<typeof p> => Boolean(p))
  const iConfirmed = me ? confirmed.includes(me.id) : false

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
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-xl text-gold-50">Times formados</p>
                <p className="text-sm text-ash">
                  {captains.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && ' · '}
                      {short(c)} {confirmed.includes(c.id) ? <span className="text-hex-300">✓ confirmou</span> : 'aguardando'}
                    </span>
                  ))}
                </p>
              </div>
              {me?.isCaptain && (
                <HexButton onClick={onConfirm} disabled={busy || iConfirmed} size="sm">
                  {iConfirmed ? 'Confirmado' : 'Confirmar times'}
                </HexButton>
              )}
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
          label={picking ? 'Sem escolha, um jogador aleatório é sorteado' : 'Capitães confirmam para ir aos bans (sem confirmação, segue sozinho)'}
        />
      </div>

      <WinChanceBar lobby={lobby} />

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
                  <li key={player.id} className="relative">
                    <ReactionBubble userId={player.id} />
                    <PlayerRow
                      riotId={player.riotId}
                      iconId={player.iconId}
                      ring={myTurn ? 'gold' : 'dim'}
                      onClick={myTurn ? () => onPick(player.id) : undefined}
                      disabled={busy}
                      highlight={player.isYou}
                      stacked
                      // O elo (selo compacto, cabe com as 3 roles) entra no lugar da #TAG; o nick com a tag e o elo por extenso ficam no tooltip.
                      // A posição na tabela fica por cima do ícone.
                      meta={player.elo ? <EloBadge elo={player.elo} compact /> : undefined}
                      iconBadge={<RankBadge position={player.rankPosition} overlay />}
                      maxNameChars={12}
                      badges={
                        <>
                          <StreakBadge streak={player.streak} />
                          {player.isYou && <YouBadge />}
                        </>
                      }
                      right={<RoleIcons roles={player.roles} />}
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
                        {pk.auto && <span className="text-ash-dim"> (último restante)</span>}
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
