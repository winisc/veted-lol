// Números de um jogador numa partida, tirados do print do placar de fim de jogo (e conferidos pelo capitão).
export interface PlayerGameStats {
  userId: number
  champion: string // id do campeão no Data Dragon (ex.: "MonkeyKing"), o mesmo dos ícones
  kills: number
  deaths: number
  assists: number
  cs: number | null
  gold: number | null
  damage: number | null // dano causado a campeões
}

// O que a leitura do print conseguiu tirar. Campo null = não deu para ler (o capitão preenche na conferência).
export interface StatsDraftRow {
  userId: number
  champion: string | null
  kills: number | null
  deaths: number | null
  assists: number | null
  cs: number | null
  gold: number | null
  damage: number | null
}

export interface StatsDraft {
  rows: StatsDraftRow[]
  read: boolean // false = a leitura não tirou nada (preencher à mão)
  note?: string // aviso para mostrar na conferência
}
