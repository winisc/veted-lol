import { useElapsed } from '../hooks/useElapsed'
import type { LobbySnapshot, Side } from '../hooks/useLobby'
import { queueModes } from '../lib/modes'
import { sfx } from '../lib/sfx'
import { formatDuration, sideStyle, splitRiotId, teamMembers } from '../lib/teams'
import TeamCard from './TeamCard'
import WinChanceBar from './WinChanceBar'
import { YouBadge } from './ui/Badges'
import EloBadge from './ui/EloBadge'
import type { LobbyPlayer } from '../hooks/useLobby'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import HexButton from './ui/HexButton'
import { FishIcon, StarIcon } from './ui/icons'
import SummonerIcon, { type IconRing } from './ui/SummonerIcon'

// Holofote do MVP/bagre: os ícones dos candidatos ficam em fila e um destaque pula de um para o outro, cada vez
// mais devagar, até parar no escolhido; ele pulsa um instante e então é revelado (ícone grande + nick deslizando).
// Começa `startAfterMs` depois de a tela abrir (depois da animação de entrada). Sem animação (reduzir movimento)
// ou com um candidato só, revela direto.
const INTRO_MS = 1800 // a estrela/peixe da entrada; o holofote começa depois
const SPOT_MS = 2400 // tempo do destaque pulando (desacelerando)
const HOLD_MS = 750 // o destaque trava no escolhido um instante (fica claro quem foi) e só então ele voa para o ícone grande

function useSpotlight(candidates: LobbyPlayer[], winnerId: number | undefined, startAfterMs: number, kind: 'mvp' | 'bagre') {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // A fila sai embaralhada a cada fim de partida (a posição do escolhido não denuncia nada).
  const [order] = useState(() => [...candidates].sort(() => Math.random() - 0.5))
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [landed, setLanded] = useState(false)
  const [done, setDone] = useState(
    reduceMotion || candidates.length < 2 || !candidates.some((c) => c.id === winnerId),
  )

  useEffect(() => {
    if (done) return
    // Momentos de cada pulo. Primeiro alguns pulos rápidos em quantidade aleatória (até uma volta) (assim o ponto de partida não
    // entrega quem vai ser escolhido); depois pulos que começam rápidos e vão espaçando (desacelera).
    const n = order.length
    const times: number[] = []
    let at = startAfterMs
    const extra = Math.floor(Math.random() * n) // até uma volta rápida, em quantidade aleatória
    for (let i = 0; i < extra; i++) {
      times.push(at)
      at += 70
    }
    const slowFrom = at
    let step = 110
    while (at < slowFrom + SPOT_MS) {
      times.push(at)
      at += step
      step *= 1.16
    }
    // Rabeira: os últimos pulos espaçam bem mais, para o destaque quase parar antes de cair no escolhido.
    for (let i = 0; i < 3; i++) {
      times.push(at)
      at += step
      step *= 1.3
    }
    // Começa num ícone calculado de trás para frente, para o último pulo cair exatamente no escolhido.
    const winnerIndex = order.findIndex((c) => c.id === winnerId)
    const first = (((winnerIndex - (times.length - 1)) % n) + n) % n

    // Cada pulo faz um "tic"; o último (no escolhido) faz o som da escolha.
    const last = times.length - 1
    const timers = times.map((t, i) =>
      window.setTimeout(() => {
        setHighlightId(order[(first + i) % n].id)
        if (i === last) sfx.choose(kind)
        else sfx.tick(kind)
      }, t),
    )
    timers.push(window.setTimeout(() => setLanded(true), times[last]))
    timers.push(window.setTimeout(() => setDone(true), times[times.length - 1] + HOLD_MS))
    return () => timers.forEach((t) => window.clearTimeout(t))
    // Roda uma vez, quando a tela de fim de jogo abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { order, highlightId, landed, done }
}

// Destaque da partida (MVP ou bagre) com o número de votos que recebeu.
function AwardCard({
  player,
  votes,
  label,
  icon,
  ring,
  classes,
  empty,
  intro,
  delayMs = 0,
  candidates,
  onRevealed,
}: {
  player: LobbyPlayer | undefined
  votes: number
  label: string
  icon: ReactNode
  ring: IconRing
  classes: string
  empty: string
  intro: 'mvp' | 'bagre' // animação de entrada: estrela que gira e brilha (MVP) ou peixe que entra nadando (bagre)
  delayMs?: number // para um aparecer depois do outro
  candidates: LobbyPlayer[] // quem estava concorrendo (o holofote passa por eles antes de parar no escolhido)
  onRevealed: () => void // a animação terminou (o ícone já pousou no lugar): pode marcar o escolhido na lista dos times
}) {
  const { order, highlightId, landed, done } = useSpotlight(candidates, player?.id, delayMs + INTRO_MS, intro)

  // Avisa quando a revelação acabou, já contando o voo do ícone até o lugar final.
  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(onRevealed, player && landed ? 1300 : 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  // Você foi o escolhido: som especial logo depois da revelação.
  useEffect(() => {
    if (!done || !player?.isYou) return
    const timer = window.setTimeout(() => sfx.itsYou(intro), 900)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  // Transição do ícone pequeno escolhido (na fila do holofote) para o ícone grande do resultado: guarda onde o
  // pequeno estava e, quando o grande aparece, faz ele sair dali (mesmo lugar e tamanho) e crescer até o lugar final.
  const spotRefs = useRef(new Map<number, HTMLSpanElement>())
  const fromRect = useRef<DOMRect | null>(null)
  const bigIcon = useRef<HTMLSpanElement>(null)
  const card = useRef<HTMLDivElement>(null)
  // Os outros candidatos, medidos no pouso: continuam na tela (no mesmo lugar) se apagando enquanto o escolhido voa.
  const ghosts = useRef<{ id: number; iconId: number; left: number; top: number }[]>([])

  useEffect(() => {
    if (!landed || !player || !card.current) return
    const base = card.current.getBoundingClientRect()
    fromRect.current = spotRefs.current.get(player.id)?.getBoundingClientRect() ?? null
    ghosts.current = order
      .filter((c) => c.id !== player.id)
      .map((c) => {
        const r = spotRefs.current.get(c.id)?.getBoundingClientRect()
        return r ? { id: c.id, iconId: c.iconId, left: r.left + r.width / 2 - base.left, top: r.top + r.height / 2 - base.top } : null
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
  }, [landed, player, order])

  useLayoutEffect(() => {
    const el = bigIcon.current
    const from = fromRect.current
    if (!done || !el || !from) return
    const to = el.getBoundingClientRect()
    const dx = from.left + from.width / 2 - (to.left + to.width / 2)
    const dy = from.top + from.height / 2 - (to.top + to.height / 2)
    el.animate(
      [
        // sai do ícone pequeno da fila...
        { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})`, filter: 'brightness(1.2)' },
        // ...pulsa no meio do voo (passa do tamanho final, com brilho forte e halo)...
        {
          transform: `translate(${dx * 0.4}px, ${dy * 0.4}px) scale(1.45) rotate(-4deg)`,
          filter: 'brightness(2.1) drop-shadow(0 0 16px currentColor)',
          offset: 0.5,
        },
        // ...e assenta no lugar com um rebote.
        { transform: 'scale(0.95)', filter: 'brightness(1.2) drop-shadow(0 0 4px currentColor)', offset: 0.82 },
        { transform: 'none', filter: 'none' },
      ],
      { duration: 1250, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
    )
  }, [done])

  return (
    <div
      ref={card}
      className={`relative flex min-h-[86px] min-w-60 flex-1 items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 ${classes}`}
      style={{ '--award-delay': `${delayMs}ms` } as CSSProperties}
    >
      {player ? (
        <>
          {/* Animação de entrada (só uma vez, quando a tela de fim de jogo abre). */}
          <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center">
            {intro === 'mvp' ? (
              <>
                <span className="award-ring" />
                <StarIcon className="award-star h-9 w-9" />
              </>
            ) : (
              <>
                <FishIcon className="award-fish h-9 w-9" />
                <span className="award-bubble award-bubble-1" />
                <span className="award-bubble award-bubble-2" />
              </>
            )}
          </span>

          {done ? (
            // Revelado: ícone grande com flash e o nick entrando da lateral, com tranco e brilho.
            <div key="reveal" className="flex min-w-0 items-center gap-3">
              {ghosts.current.map((g) => (
                <span
                  key={g.id}
                  aria-hidden="true"
                  className="award-ghost pointer-events-none absolute -ml-[18px] -mt-[18px]"
                  style={{ left: g.left, top: g.top }}
                >
                  <SummonerIcon iconId={g.iconId} size="sm" ring="dim" />
                </span>
              ))}
              {/* Sem holofote (um candidato só), o ícone entra com um flash; com holofote, ele vem da fila (acima). */}
              <span ref={bigIcon} className={`inline-block shrink-0 ${fromRect.current ? '' : 'award-icon-land'}`}>
                <SummonerIcon iconId={player.iconId} size="lg" ring={ring} />
              </span>
              <div className="min-w-0">
                <p className="award-label-in flex items-center gap-1.5 font-display text-sm">
                  {icon} {label}
                </p>
                <p className="award-name-land truncate font-display text-2xl leading-tight text-gold-50">
                  {splitRiotId(player.riotId)[0]}
                </p>
                {/* "5 votos" nunca quebra em duas linhas; se faltar espaço, o elo e o "Você" é que descem. */}
                <p className="award-votes-land flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ash">
                  <span className="whitespace-nowrap">
                    {votes} {votes === 1 ? 'voto' : 'votos'}
                  </span>
                  <EloBadge elo={player.elo} />
                  {player.isYou && <YouBadge />}
                </p>
              </div>
            </div>
          ) : (
            // Holofote: os candidatos em fila e o destaque pulando entre eles.
            <div className="award-reveal flex min-w-0 flex-col gap-2" aria-label={`${label}: revelando...`}>
              <p className="flex items-center gap-1.5 font-display text-sm">
                {icon} {label}
              </p>
              <div className="flex items-center gap-1.5">
                {order.map((c) => {
                  const on = c.id === highlightId
                  return (
                    <span
                      key={c.id}
                      ref={(el) => {
                        if (el) spotRefs.current.set(c.id, el)
                        else spotRefs.current.delete(c.id)
                      }}
                      className={`inline-block transition-[transform,opacity] ${landed ? 'duration-500' : 'duration-100'} ${
                        on ? 'scale-110 opacity-100' : 'scale-90 opacity-30'
                      }`}
                    >
                      <SummonerIcon iconId={c.iconId} size="sm" ring={on ? ring : 'dim'} />
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="w-full text-center text-sm text-ash">{empty}</p>
      )}
    </div>
  )
}

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onRequeue: () => void
  onLeave: () => void
}

// Tela de fim de jogo, no estilo "Vitória / Derrota" do LoL.
export default function LobbyFinished({ lobby, skew, busy, onRequeue, onLeave }: Props) {
  const { match } = lobby
  const duration = useElapsed(match.startedAt, skew, match.endedAt)
  const me = lobby.players.find((p) => p.isYou)
  const remake = match.outcome === 'remake'
  const winnerSide = remake ? null : (match.outcome as Side)
  const won = !remake && me?.team === winnerSide

  const mvp = lobby.players.find((p) => p.id === match.mvpId)
  const mvpVotes = mvp && match.mvpCounts ? (match.mvpCounts[mvp.id] ?? 0) : 0
  const bagre = lobby.players.find((p) => p.id === match.bagreId)
  const bagreVotes = bagre && match.bagreCounts ? (match.bagreCounts[bagre.id] ?? 0) : 0

  // O MVP e o bagre só aparecem marcados na lista dos times depois que a animação de cada um termina.
  const [mvpRevealed, setMvpRevealed] = useState(false)
  const [bagreRevealed, setBagreRevealed] = useState(false)

  const headline = remake ? 'Remake' : won ? 'Vitória' : 'Derrota'
  const headlineColor = remake ? 'text-gold-50' : won ? 'text-hex-100' : 'text-team-red'


  return (
    <div className="space-y-4">
      {/* Resultado, MVP e bagre lado a lado */}
      <div className="grid items-center gap-4 md:grid-cols-[1fr_auto]">
        <div className="text-center md:text-left">
          <p
            className={`font-display text-6xl leading-none ${headlineColor} ${won ? '' : ''}`}
          >
            {headline}
          </p>
          <p className="mt-2 text-sm text-ash">
            {remake
              ? 'Partida anulada. Não conta no histórico de ninguém.'
              : `${sideStyle[winnerSide!].name} venceu. Resultado salvo no histórico.`}{' '}
            Duração <span className="font-cond font-semibold tabular-nums text-gold-50">{formatDuration(duration)}</span>.
          </p>
        </div>

        {!remake && (
          <div className="flex flex-wrap gap-3">
            <AwardCard
              player={mvp}
              votes={mvpVotes}
              label="MVP da partida"
              icon={<StarIcon className="h-4 w-4" />}
              ring="gold"
              classes="border-gold-200/40 bg-gold-200/[0.06] text-gold-200"
              empty="Ninguém votou, então não houve MVP."
              intro="mvp"
              onRevealed={() => setMvpRevealed(true)}
              candidates={lobby.players.filter((p) => match.mvpCandidates.includes(p.id))}
            />
            <AwardCard
              player={bagre}
              votes={bagreVotes}
              label="Bagre da partida"
              icon={<FishIcon className="h-4 w-4" />}
              ring="bagre"
              classes="border-bagre/40 bg-bagre/[0.06] text-bagre"
              empty="Ninguém votou, então não houve bagre."
              intro="bagre"
              onRevealed={() => setBagreRevealed(true)}
              delayMs={8800} // começa depois que o MVP termina de aparecer
              candidates={lobby.players.filter((p) => match.bagreCandidates.includes(p.id))}
            />
          </div>
        )}
      </div>

      {/* Quanto cada time tinha de chance antes da partida (pelo elo e pela tabela) */}
      <WinChanceBar lobby={lobby} />

      <div className="grid items-start gap-3 md:grid-cols-2">
        {(['blue', 'red'] as Side[]).map((side) => (
          <TeamCard
            key={side}
            side={side}
            members={teamMembers(lobby, side)}
            mvpId={mvpRevealed ? match.mvpId : null}
            bagreId={bagreRevealed ? match.bagreId : null}
            winner={winnerSide === side}
          />
        ))}
      </div>

      {/* Fim: procurar outra partida (no mesmo modo de fila) ou só sair do lobby. */}
      <div className="flex flex-col items-center gap-2 border-t border-rim pt-4">
        <div className="flex flex-wrap justify-center gap-3">
          <HexButton onClick={onRequeue} disabled={busy}>
            Entrar na fila novamente
          </HexButton>
          <HexButton variant="secondary" onClick={onLeave} disabled={busy}>
            Sair
          </HexButton>
        </div>
        <p className="text-xs text-ash">
          "Entrar na fila novamente" sai do lobby e já entra na fila do {queueModes[lobby.mode ?? 'vote'].name.toLowerCase()}.
        </p>
      </div>
    </div>
  )
}
