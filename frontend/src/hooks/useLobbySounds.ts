import { useEffect, useRef } from 'react'
import { sfx } from '../lib/sfx'
import type { LobbySnapshot } from './useLobby'

const TURN_PHASES = ['picking', 'side', 'order']

// Sons do lobby que ajudam a não perder o momento:
//  - contagem: "tic" nos últimos 5 segundos de uma fase com prazo, só quando você ainda precisa agir;
//  - momentos do lobby: capitães revelados, cada pick e voto confirmado.
// Nada toca ao abrir a página no meio de uma fase (ex.: F5): só nas mudanças vistas com a página aberta.
export function useLobbySounds(lobby: LobbySnapshot | null | undefined, skew: number) {
  const meId = lobby?.players.find((p) => p.isYou)?.id
  const myTurn = Boolean(lobby && meId !== undefined && TURN_PHASES.includes(lobby.phase) && lobby.draft.currentTurnId === meId)

  const needsAction = Boolean(
    lobby &&
      meId !== undefined &&
      ((lobby.phase === 'voting' && lobby.myVote === null) ||
        myTurn ||
        (lobby.phase === 'mvp' && lobby.match.myMvpVote === null) ||
        (lobby.phase === 'bagre' && lobby.match.myBagreVote === null)),
  )

  // Mudanças de fase vistas com a página aberta.
  const phase = lobby?.phase
  const prevPhase = useRef<string | undefined>(undefined)
  useEffect(() => {
    const before = prevPhase.current
    prevPhase.current = phase
    if (before === undefined || before === phase) return
    if (phase === 'captains') sfx.captains()
  }, [phase])

  // Cada pick do draft (com destaque quando o escolhido é você).
  const picks = lobby?.draft.picks.length ?? 0
  const prevPicks = useRef<number | undefined>(undefined)
  useEffect(() => {
    const before = prevPicks.current
    prevPicks.current = picks
    if (before === undefined || picks <= before || !lobby) return
    sfx.pick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks])

  // Voto confirmado: quando um voto seu passa de "nenhum" para algum.
  const votes = [lobby?.myVote, lobby?.match.myResultVote, lobby?.match.myMvpVote, lobby?.match.myBagreVote]
  const voteKey = votes.map((v) => (v === null || v === undefined ? '' : 'x')).join('|')
  const prevVotes = useRef<string | undefined>(undefined)
  useEffect(() => {
    const before = prevVotes.current
    prevVotes.current = voteKey
    if (before === undefined) return
    const added = voteKey.split('|').some((v, i) => v === 'x' && before.split('|')[i] !== 'x')
    if (added) sfx.vote()
  }, [voteKey])

  // Contagem dos últimos 5 segundos (o último "tic" é mais forte). Recomeça a cada novo prazo.
  const endsAt = lobby?.endsAt ?? null
  useEffect(() => {
    if (!needsAction || endsAt === null) return
    let lastSecond: number | null = null
    const timer = window.setInterval(() => {
      const left = Math.ceil((endsAt - (Date.now() + skew)) / 1000)
      if (left >= 1 && left <= 5 && left !== lastSecond) {
        lastSecond = left
        sfx.countdown(left === 1)
      }
    }, 200)
    return () => window.clearInterval(timer)
  }, [needsAction, endsAt, skew])
}
