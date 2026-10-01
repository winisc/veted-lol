import { lobbyConfig } from './lobby.config'
import type { Lobby, LobbySnapshot, MatchOutcome, Side } from './lobby.types'

export function countVotes(lobby: Lobby) {
  const counts = new Map<number, number>()
  for (const target of lobby.votes.values()) counts.set(target, (counts.get(target) ?? 0) + 1)
  return counts
}

export function countResultVotes(lobby: Lobby): Record<MatchOutcome, number> {
  const counts: Record<MatchOutcome, number> = { blue: 0, red: 0, remake: 0 }
  for (const choice of lobby.resultVotes.values()) counts[choice]++
  return counts
}

export function countMvpVotes(lobby: Lobby) {
  const counts = new Map<number, number>()
  for (const target of lobby.mvpVotes.values()) counts.set(target, (counts.get(target) ?? 0) + 1)
  return counts
}

export function votesNeeded(lobby: Lobby) {
  return Math.min(lobbyConfig.matchVotesNeeded, lobby.players.length)
}

// Jogadores que ainda podem ser escolhidos no draft.
export function draftPool(lobby: Lobby) {
  const picked = new Set(lobby.picks.map((p) => p.playerId))
  return lobby.players.filter((p) => !lobby.captains.includes(p.userId) && !picked.has(p.userId))
}

export function currentPickerId(lobby: Lobby): number | null {
  return lobby.phase === 'picking' ? (lobby.pickOrder[lobby.pickIndex] ?? null) : null
}

// Jogadores do time vencedor: são os candidatos a MVP.
export function mvpCandidates(lobby: Lobby): number[] {
  return lobby.outcome === 'blue' || lobby.outcome === 'red' ? lobby.teams[lobby.outcome] : []
}

function teamOf(lobby: Lobby, userId: number): Side | null {
  if (lobby.teams.blue.includes(userId)) return 'blue'
  if (lobby.teams.red.includes(userId)) return 'red'
  return null
}

function turnPicksLeft(lobby: Lobby) {
  const picker = currentPickerId(lobby)
  if (picker === null) return 0
  let count = 0
  for (let i = lobby.pickIndex; lobby.pickOrder[i] === picker; i++) count++
  return count
}

export function snapshotFor(lobby: Lobby, userId: number): LobbySnapshot {
  const counts = countVotes(lobby)
  const captainsRevealed = lobby.phase !== 'voting'
  const mvpRevealed = lobby.phase === 'finished'
  const mvpCounts = countMvpVotes(lobby)

  return {
    id: lobby.id,
    phase: lobby.phase,
    endsAt: lobby.endsAt,
    durationMs: lobby.durationMs,
    now: Date.now(),
    players: lobby.players.map((p) => ({
      id: p.userId,
      riotId: p.riotId,
      iconId: p.iconId,
      isYou: p.userId === userId,
      hasVoted: lobby.votes.has(p.userId),
      votes: captainsRevealed ? (counts.get(p.userId) ?? 0) : null,
      isCaptain: lobby.captains.includes(p.userId),
      team: teamOf(lobby, p.userId),
    })),
    myVote: lobby.votes.get(userId) ?? null,
    votedCount: lobby.votes.size,
    captains: lobby.captains,
    draft: {
      firstPickId: lobby.firstPickId,
      sideChooserId: lobby.sideChooserId,
      sides: { blue: lobby.sides.blue ?? null, red: lobby.sides.red ?? null },
      currentTurnId: lobby.phase === 'side' ? lobby.sideChooserId : currentPickerId(lobby),
      turnPicksLeft: turnPicksLeft(lobby),
      pickIndex: lobby.pickIndex,
      totalPicks: lobby.pickOrder.length,
      picks: lobby.picks,
    },
    match: {
      startedAt: lobby.startedAt,
      endedAt: lobby.endedAt,
      votesNeeded: votesNeeded(lobby),
      endVotes: lobby.endVotes.size,
      iVotedEnd: lobby.endVotes.has(userId),
      resultCounts: countResultVotes(lobby),
      myResultVote: lobby.resultVotes.get(userId) ?? null,
      outcome: lobby.outcome,
      mvpCandidates: mvpCandidates(lobby),
      mvpVotedCount: lobby.mvpVotes.size,
      myMvpVote: lobby.mvpVotes.get(userId) ?? null,
      mvpCounts: mvpRevealed ? Object.fromEntries(mvpCounts) : null,
      mvpId: lobby.mvpId,
      gameNumber: lobby.gameNumber,
      rematchVotes: lobby.rematchVotes.size,
      iVotedRematch: lobby.rematchVotes.has(userId),
      rematchAvailable: lobby.left.size === 0,
    },
  }
}
