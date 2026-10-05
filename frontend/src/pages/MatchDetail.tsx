import { Link, useNavigate, useParams } from 'react-router-dom'
import { BagreBadge, CaptainBadge, MvpBadge } from '../components/ui/Badges'
import { FishIcon, StarIcon } from '../components/ui/icons'
import Notice from '../components/ui/Notice'
import Panel from '../components/ui/Panel'
import PlayerRow from '../components/ui/PlayerRow'
import { useProfilePath } from '../components/ui/PlayerLink'
import { useApi } from '../hooks/useApi'
import type { MatchOutcome, Side } from '../hooks/useLobby'
import { formatDateTime } from '../lib/format'
import { queueModes, type QueueMode } from '../lib/modes'
import { formatDuration, short, sideStyle } from '../lib/teams'

interface MatchPlayer {
  userId: number
  riotId: string
  iconId: number
  side: Side
  isCaptain: boolean
  result: 'win' | 'loss' | 'remake'
  pickOrder: number | null
  pickedBy: number | null
  mvpVotes: number
  bagreVotes: number
}

interface MatchDetailData {
  id: string
  mode: QueueMode
  endedAt: string
  durationSeconds: number
  outcome: MatchOutcome
  mvpId: number | null
  bagreId: number | null
  players: MatchPlayer[]
  hasVotes: boolean
}

const votesText = (n: number, what: string) => `${n} ${n === 1 ? 'voto' : 'votos'} para ${what}`

// Capitão primeiro, depois os picks na ordem em que foram feitos.
const byDraft = (a: MatchPlayer, b: MatchPlayer) =>
  Number(b.isCaptain) - Number(a.isCaptain) || (a.pickOrder ?? 99) - (b.pickOrder ?? 99)

// Uma partida salva: resultado, times, ordem do draft, MVP e bagre.
export default function MatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const profilePath = useProfilePath()
  const { data, error, loading } = useApi<{ match: MatchDetailData }>(`/matches/${id}`)

  if (loading) return <p className="text-ash">Carregando partida...</p>
  if (error || !data) return <Notice>{error || 'Não foi possível carregar a partida.'}</Notice>

  const { match } = data
  const remake = match.outcome === 'remake'
  const winner = remake ? null : (match.outcome as Side)
  const nameOf = (userId: number | null) => short(match.players.find((p) => p.userId === userId))

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => navigate(-1)} className="text-sm text-ash transition-colors hover:text-gold-50">
        ← Voltar
      </button>

      <section className="rounded-xl border border-rim bg-abyss px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className={`font-display text-3xl ${winner ? sideStyle[winner].text : 'text-gold-50'}`}>
            {winner ? `Vitória do ${sideStyle[winner].name}` : 'Remake'}
          </h1>
          <span className="rounded bg-gold-200/15 px-2 py-0.5 text-xs font-semibold text-gold-200">{queueModes[match.mode ?? 'vote'].name}</span>
        </div>
        <p className="mt-1 text-sm text-ash">
          {formatDateTime(match.endedAt)} · duração{' '}
          <span className="font-cond font-semibold tabular-nums text-gold-50">{formatDuration(match.durationSeconds)}</span>
          {remake && ' · partida anulada, não conta para a tabela'}
        </p>
      </section>

      <div className="grid items-start gap-3 md:grid-cols-2">
        {(['blue', 'red'] as Side[]).map((side) => {
          const style = sideStyle[side]
          const team = match.players.filter((p) => p.side === side).sort(byDraft)
          return (
            <Panel
              key={side}
              bodyClassName="p-1.5"
              title={
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${style.bar}`} aria-hidden="true" />
                  {style.name}
                </span>
              }
              action={winner === side ? <span className="rounded bg-gold-200 px-2 py-0.5 text-xs font-semibold text-void">Vitória</span> : undefined}
              className={winner === side ? 'border-gold-200/60' : ''}
            >
              <ul className="space-y-1">
                {team.map((p) => (
                  <li key={p.userId}>
                    <PlayerRow
                      riotId={p.riotId}
                      iconId={p.iconId}
                      to={profilePath(p.userId)}
                      ring={p.userId === match.mvpId ? 'gold' : p.userId === match.bagreId ? 'bagre' : style.ring}
                      badges={
                        <>
                          {p.isCaptain && <CaptainBadge />}
                          {p.userId === match.mvpId && <MvpBadge />}
                          {p.userId === match.bagreId && <BagreBadge />}
                        </>
                      }
                      right={
                        <span className="flex flex-col items-end text-xs leading-tight text-ash">
                          {p.isCaptain ? (
                            <span>Capitão</span>
                          ) : p.pickOrder !== null ? (
                            <span title={`Escolhido por ${nameOf(p.pickedBy)}`}>
                              Pick <span className="font-cond text-sm font-bold text-gold-50">{p.pickOrder}</span>
                            </span>
                          ) : null}
                          {match.hasVotes && (p.mvpVotes > 0 || p.bagreVotes > 0) && (
                            // Votos que o jogador recebeu: estrela = MVP, peixe = bagre.
                            <span className="flex items-center gap-2 font-cond text-sm font-semibold tabular-nums">
                              {p.mvpVotes > 0 && (
                                <span className="flex items-center gap-0.5 text-gold-200" title={votesText(p.mvpVotes, 'MVP')}>
                                  <StarIcon className="h-3 w-3" /> {p.mvpVotes}
                                </span>
                              )}
                              {p.bagreVotes > 0 && (
                                <span className="flex items-center gap-0.5 text-bagre" title={votesText(p.bagreVotes, 'bagre')}>
                                  <FishIcon className="h-3 w-3" /> {p.bagreVotes}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          )
        })}
      </div>

      <p className="text-center text-sm">
        <Link to="/tabela" className="text-gold-200 hover:text-gold-50">
          Ver a tabela
        </Link>
      </p>
    </div>
  )
}
