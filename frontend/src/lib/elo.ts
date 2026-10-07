// Elo (rank) do LoL de um jogador, como vem do servidor.
export interface PlayerElo {
  tier: string // IRON ... CHALLENGER
  rank: string // I, II, III, IV (Mestre para cima não tem divisão)
  leaguePoints: number
  wins: number
  losses: number
  queue: 'solo' | 'flex'
}

// Nome em português, sigla (para o selo compacto) e a cor de cada elo.
const tiers: Record<string, { name: string; abbr: string; color: string }> = {
  IRON: { name: 'Ferro', abbr: 'F', color: '#8b8b93' },
  BRONZE: { name: 'Bronze', abbr: 'B', color: '#c0834f' },
  SILVER: { name: 'Prata', abbr: 'P', color: '#aab6c6' },
  GOLD: { name: 'Ouro', abbr: 'O', color: '#e4b650' },
  PLATINUM: { name: 'Platina', abbr: 'P', color: '#4fbfb2' },
  EMERALD: { name: 'Esmeralda', abbr: 'E', color: '#3ccb82' },
  DIAMOND: { name: 'Diamante', abbr: 'D', color: '#6fa8f7' },
  MASTER: { name: 'Mestre', abbr: 'M', color: '#bb6be6' },
  GRANDMASTER: { name: 'Grão-Mestre', abbr: 'GM', color: '#e65a64' },
  CHALLENGER: { name: 'Desafiante', abbr: 'C', color: '#f3d680' },
}

const divisions: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }
const apexTiers = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']) // sem divisão

export function eloInfo(elo: PlayerElo) {
  const tier = tiers[elo.tier] ?? { name: elo.tier, abbr: elo.tier.slice(0, 2), color: '#9b9ea8' }
  const division = apexTiers.has(elo.tier) ? '' : elo.rank
  const number = apexTiers.has(elo.tier) ? '' : String(divisions[elo.rank] ?? '')
  return {
    color: tier.color,
    full: division ? `${tier.name} ${division}` : tier.name, // "Ouro II", "Mestre"
    short: `${tier.abbr}${number}`, // "O2", "M"
    detail: `${division ? `${tier.name} ${division}` : tier.name} · ${elo.leaguePoints} PDL · ${elo.wins}V ${elo.losses}D (${elo.queue === 'solo' ? 'solo/duo' : 'flex'})`,
  }
}
