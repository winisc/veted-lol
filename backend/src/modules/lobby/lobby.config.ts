const seconds = (name: string, fallback: number) => (Number(process.env[name]) || fallback) * 1000

// Os tempos podem ser encurtados por variável de ambiente para testar (aceita decimais, ex.: 0.5).
export const lobbyConfig = {
  voteMs: seconds('LOBBY_VOTE_SECONDS', 30),
  revealMs: seconds('LOBBY_REVEAL_SECONDS', 6), // tela com o resultado dos capitães
  coinflipMs: seconds('LOBBY_COINFLIP_SECONDS', 5),
  sideMs: seconds('LOBBY_SIDE_SECONDS', 20),
  pickMs: seconds('LOBBY_PICK_SECONDS', 30), // tempo para cada pick
  doneMs: seconds('LOBBY_DONE_SECONDS', 5), // tela do draft finalizado, antes da partida começar
  mvpMs: seconds('LOBBY_MVP_SECONDS', 60), // votação de MVP
  rematchMs: seconds('LOBBY_REMATCH_SECONDS', 5), // aviso de troca de lados antes da revanche

  captains: 2,
  // Picks consecutivos por vez, alternando entre os capitães (quem ganhou o sorteio começa).
  // Com 10 jogadores e 2 capitães sobram 8 picks: 1+2+2+2+1.
  pickPattern: [1, 2, 2, 2, 1],

  // Votos para encerrar a partida e para decidir o vencedor/remake (limitado ao nº de jogadores).
  matchVotesNeeded: Number(process.env.MATCH_VOTES_NEEDED) || 6,
}
