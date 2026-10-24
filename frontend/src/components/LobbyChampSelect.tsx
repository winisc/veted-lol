import { useMemo, useState } from 'react'
import type { LobbyPlayer, LobbySnapshot, Side } from '../hooks/useLobby'
import { useChampions } from '../lib/champions'
import { sideStyle, splitRiotId, teamMembers } from '../lib/teams'
import PhaseTimer from './PhaseTimer'
import HexButton from './ui/HexButton'
import SummonerIcon from './ui/SummonerIcon'

interface Props {
  lobby: LobbySnapshot
  skew: number
  busy: boolean
  onBan: (champion: string) => void
  onPick: (champion: string) => void
  onHover: (champion: string | null) => void // pré-seleção: os outros veem como "selecionando"
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const firstName = (riotId: string) => splitRiotId(riotId)[0]

// Seleção de campeões (5x5), como a escolha alternada do LoL:
//  1. Bans: só os dois capitães banem, ao mesmo tempo, um campeão por jogador do time. Cada time vê os bans do
//     próprio capitão; os do adversário aparecem quando os dois terminarem (ou o tempo acabar).
//  2. Picks: em vezes alternadas (1-2-2-2-2-1), na ordem do draft. Campeão banido ou já escolhido fica bloqueado.
// Ao clicar num campeão ele fica pré-selecionado (os outros veem "selecionando"); só vale depois de confirmar.
export default function LobbyChampSelect({ lobby, skew, busy, onBan, onPick, onHover }: Props) {
  const select = lobby.champSelect!
  const { champions, nameOf, iconOf } = useChampions()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const me = lobby.players.find((p) => p.isYou)
  const banning = lobby.phase === 'bans'
  const pickOf = (id: number) => select.picks.find((p) => p.userId === id)?.champion ?? null
  const myBans = me ? select.bans.find((b) => b.userId === me.id) : undefined // só existe se você é capitão
  const bansLeft = myBans ? select.banCount - myBans.count : 0
  const myTurn = !banning && me ? select.turn.includes(me.id) && !pickOf(me.id) : false
  const canAct = banning ? bansLeft > 0 : myTurn

  // Bloqueados: nos bans, os que você já baniu; nos picks, os banidos e os já escolhidos.
  const taken = useMemo(
    () =>
      new Set(
        banning
          ? (myBans?.champions ?? [])
          : [...select.bans.flatMap((b) => b.champions ?? []), ...select.picks.map((p) => p.champion)],
      ),
    [banning, select, myBans],
  )
  const term = normalize(search.trim())
  const list = champions.filter((c) => !term || normalize(c.name).includes(term))
  const choice = selected && !taken.has(selected) ? selected : null

  function confirm() {
    if (!choice) return
    if (banning) onBan(choice)
    else onPick(choice)
    setSelected(null)
  }

  const nameById = (id: number) => firstName(lobby.players.find((p) => p.id === id)?.riotId ?? '')

  // Faixa de status: o que está acontecendo e, em destaque, quando é a sua vez.
  const headline = canAct
    ? banning
      ? 'Sua vez de banir'
      : 'Sua vez de escolher'
    : banning
      ? myBans
        ? 'Bans completos'
        : 'Capitães banindo'
      : select.turn.length
        ? `${select.turn.map(nameById).join(' e ')} ${select.turn.length > 1 ? 'escolhem' : 'escolhe'}`
        : 'Escolha de campeões'
  const detail = banning
    ? canAct
      ? `Faltam ${bansLeft} de ${select.banCount}. Os bans do adversário aparecem no fim.`
      : select.bans.map((b) => `${nameById(b.userId)} ${b.count}/${select.banCount}`).join(' · ')
    : canAct
      ? 'Clique num campeão para pré-selecionar e confirme.'
      : 'Campeões banidos ou já escolhidos ficam bloqueados.'

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-col gap-3 rounded-xl border px-4 py-3 transition-colors md:flex-row md:items-center ${
          canAct
            ? 'border-gold-200/70 bg-linear-to-r from-gold-200/15 via-gold-200/[0.04] to-transparent'
            : 'border-rim bg-void/40'
        }`}
        aria-live="polite"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ash">
            {banning ? 'Fase de bans' : 'Escolha de campeões'}
          </p>
          <p className={`flex items-center gap-2 font-display text-2xl leading-tight ${canAct ? 'text-gold-200' : 'text-gold-50'}`}>
            {canAct && (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-200 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold-200" />
              </span>
            )}
            <span className="truncate">{headline}</span>
          </p>
          <p className="truncate text-sm text-ash">{detail}</p>
        </div>
        <div className="md:w-80">
          <PhaseTimer
            endsAt={lobby.endsAt}
            durationMs={lobby.durationMs}
            skew={skew}
            label={banning ? 'Bans que faltarem ficam vazios' : 'Sem confirmar: pré-seleção ou aleatório'}
          />
        </div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[15.5rem_minmax(0,1fr)_15.5rem]">
        <TeamColumn side="blue" members={teamMembers(lobby, 'blue')} lobby={lobby} pickOf={pickOf} iconOf={iconOf} nameOf={nameOf} />

        {/* Campeões */}
        <div
          className={`order-first rounded-xl border bg-void/40 p-3 lg:order-none ${
            canAct ? 'border-gold-200/60 shadow-[0_0_0_1px_rgba(200,170,110,0.15),0_0_28px_rgba(200,170,110,0.12)]' : 'border-rim'
          }`}
        >
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar campeão"
              aria-label="Buscar campeão"
              className="h-10 min-w-40 flex-1 rounded-md border border-rim bg-panel px-3 text-sm text-gold-50 outline-none placeholder:text-ash-dim focus:border-gold-200"
            />
            <HexButton
              onClick={confirm}
              disabled={busy || !canAct || !choice}
              variant={!canAct ? 'secondary' : banning ? 'danger' : 'primary'}
              className="min-w-44"
            >
              {banning
                ? !myBans
                  ? 'Só os capitães banem'
                  : bansLeft === 0
                    ? 'Bans completos'
                    : choice
                      ? `Banir ${nameOf(choice)}`
                      : 'Escolha um ban'
                : myTurn
                  ? choice
                    ? `Confirmar ${nameOf(choice)}`
                    : 'Escolha um campeão'
                  : 'Aguarde sua vez'}
            </HexButton>
          </div>

          <div className="relative">
            <ul className="grid h-[26rem] grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] content-start gap-x-1.5 gap-y-2 overflow-y-auto pb-6 pr-1">
              {list.map((c) => {
                const blocked = taken.has(c.id)
                const active = choice === c.id
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      title={blocked ? `${c.name} (indisponível)` : c.name}
                      disabled={blocked || !canAct}
                      onClick={() => {
                        setSelected(c.id)
                        onHover(c.id)
                      }}
                      className="group flex w-full flex-col items-center gap-1 disabled:cursor-default"
                    >
                      <span
                        className={`relative block aspect-square w-full overflow-hidden rounded-md border-2 transition ${
                          active
                            ? banning
                              ? 'border-team-red shadow-[0_0_12px_rgba(232,64,87,0.45)]'
                              : 'border-gold-200 shadow-[0_0_12px_rgba(200,170,110,0.45)]'
                            : 'border-transparent group-enabled:group-hover:border-gold-200/50'
                        }`}
                      >
                        <img
                          src={iconOf(c.id)}
                          alt=""
                          loading="lazy"
                          className={`h-full w-full scale-[1.08] object-cover transition ${
                            blocked ? 'opacity-30 grayscale' : canAct ? 'group-hover:scale-[1.14]' : 'opacity-80'
                          }`}
                        />
                        {blocked && (
                          <span aria-hidden="true" className="absolute left-[-15%] top-1/2 h-[2px] w-[130%] rotate-45 bg-team-red/80" />
                        )}
                      </span>
                      <span
                        className={`w-full truncate text-center text-[11px] leading-none ${
                          active ? 'font-semibold text-gold-50' : blocked ? 'text-ash-dim' : 'text-ash group-enabled:group-hover:text-gold-50'
                        }`}
                      >
                        {c.name}
                      </span>
                    </button>
                  </li>
                )
              })}
              {list.length === 0 && <li className="col-span-full py-10 text-center text-sm text-ash">Nenhum campeão com esse nome.</li>}
            </ul>
            {/* Indica que a lista continua para baixo */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-abyss to-transparent" />
          </div>
        </div>

        <TeamColumn side="red" members={teamMembers(lobby, 'red')} lobby={lobby} pickOf={pickOf} iconOf={iconOf} nameOf={nameOf} />
      </div>
    </div>
  )
}

function TeamColumn({
  side,
  members,
  lobby,
  pickOf,
  iconOf,
  nameOf,
}: {
  side: Side
  members: LobbyPlayer[]
  lobby: LobbySnapshot
  pickOf: (id: number) => string | null
  iconOf: (id: string) => string
  nameOf: (id: string) => string
}) {
  const style = sideStyle[side]
  const select = lobby.champSelect!
  const banning = lobby.phase === 'bans'
  // Bans do capitão deste time (os do adversário ficam escondidos durante os bans: só a contagem).
  const captainBans = select.bans.find((b) => members.some((m) => m.id === b.userId))
  const slots = Array.from({ length: select.banCount }, (_, i) => captainBans?.champions?.[i] ?? null)
  const hiddenCount = captainBans && captainBans.champions === null ? captainBans.count : 0
  // Ban que o capitão do seu time está pré-selecionando (só o próprio time vê): no próximo espaço vazio.
  const banHover = banning ? (select.hovers ?? []).find((h) => h.userId === captainBans?.userId)?.champion : undefined
  const hoverSlot = captainBans?.champions ? captainBans.champions.length : -1

  return (
    <div className="overflow-hidden rounded-xl border border-rim bg-abyss">
      <header className="border-b border-rim px-3 pb-2.5 pt-2">
        <p className={`flex items-center gap-2 whitespace-nowrap font-display text-base ${style.text}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${style.bar}`} aria-hidden="true" />
          {style.name}
        </p>
        {/* Bans do time (feitos pelo capitão) */}
        <div className="mt-2 flex items-center gap-1" aria-label="Bans do time">
          {slots.map((ban, i) => {
            const hovering = !ban && banHover && i === hoverSlot
            const hidden = !ban && i < hiddenCount
            return (
              <span
                key={i}
                title={
                  ban
                    ? `Ban: ${nameOf(ban)}`
                    : hovering
                      ? `Selecionando ban: ${nameOf(banHover)}`
                      : hidden
                        ? 'Ban escondido até o fim dos bans'
                        : 'Sem ban'
                }
                className={`relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded border ${
                  ban
                    ? 'border-team-red/60'
                    : hovering
                      ? 'border-dashed border-team-red/70'
                      : hidden
                        ? 'border-team-red/40 bg-team-red/10'
                        : 'border-rim bg-void/60'
                }`}
              >
                {ban && (
                  <>
                    <img src={iconOf(ban)} alt="" className="h-full w-full scale-110 object-cover grayscale" />
                    <span aria-hidden="true" className="absolute h-[2px] w-[140%] rotate-45 bg-team-red" />
                  </>
                )}
                {hovering && <img src={iconOf(banHover)} alt="" className="h-full w-full scale-110 object-cover opacity-45" />}
                {hidden && <span className="font-cond text-sm font-bold text-team-red">?</span>}
              </span>
            )
          })}
        </div>
      </header>

      <ul className="space-y-1 p-1.5">
        {members.map((m) => {
          const champion = pickOf(m.id)
          const hovered = !champion && !banning ? (select.hovers ?? []).find((h) => h.userId === m.id)?.champion : undefined
          const choosing = !banning && select.turn.includes(m.id) && !champion
          const isCaptain = lobby.captains.includes(m.id)
          const captainCount = select.bans.find((b) => b.userId === m.id)?.count ?? 0
          const banningNow = banning && isCaptain && captainCount < select.banCount
          const active = choosing || banningNow
          return (
            <li
              key={m.id}
              className={`relative flex items-center gap-2.5 overflow-hidden rounded-lg py-1.5 pl-2.5 pr-2 transition-colors ${
                active ? 'bg-gold-200/10' : m.isYou ? 'bg-gold-200/[0.05]' : 'bg-panel'
              }`}
            >
              {/* barra lateral: quem está agindo agora */}
              {active && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-gold-200" />}

              <span
                className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md ${
                  champion
                    ? 'ring-1 ring-gold-200/60'
                    : hovered
                      ? 'outline-2 outline-dashed outline-gold-200/70'
                      : active
                        ? 'ring-2 ring-gold-200/80'
                        : 'ring-1 ring-rim'
                }`}
              >
                {champion ? (
                  <img src={iconOf(champion)} alt="" className="h-full w-full scale-110 object-cover" />
                ) : hovered ? (
                  <img src={iconOf(hovered)} alt="" className="h-full w-full scale-110 object-cover opacity-50" />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-void/70 opacity-60 grayscale">
                    <SummonerIcon iconId={m.iconId} size="sm" ring="dim" />
                  </span>
                )}
                {active && !hovered && <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-gold-200/15" />}
              </span>

              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${m.isYou ? 'text-gold-200' : 'text-gold-50'}`} title={m.riotId}>
                  {firstName(m.riotId)}
                </span>
                {champion ? (
                  <span className="block truncate text-xs text-gold-50/80">{nameOf(champion)}</span>
                ) : hovered ? (
                  <span className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="shrink-0 rounded-sm border border-gold-200/50 px-1 text-[9px] font-bold uppercase tracking-wider text-gold-200">
                      Selecionando
                    </span>
                    <span className="truncate text-ash">{nameOf(hovered)}</span>
                  </span>
                ) : (
                  <span className={`block truncate text-xs ${active ? 'text-gold-200' : 'text-ash-dim'}`}>
                    {choosing
                      ? 'Escolhendo...'
                      : banning && isCaptain
                        ? captainCount >= select.banCount
                          ? 'Bans completos'
                          : `Banindo · ${captainCount}/${select.banCount}`
                        : isCaptain
                          ? 'Capitão'
                          : ' '}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
