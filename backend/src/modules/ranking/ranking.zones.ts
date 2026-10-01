// Zonas do ranking, definidas pela posição e pelo total de jogadores (funciona para qualquer tamanho de grupo):
//
//   top        #1                           "O Melhor"
//   good       logo depois do topo          "Bom trabalho"
//   basic      o miolo, a maior zona        "Fez o básico"
//   carry      abaixo do miolo              "Empena lobby"
//   bleed      parte baixa                  "Sangria"
//   uninstall  o último colocado            "Desinstala"
//
// Com 10 jogadores ficam 1 / 2 / 3 / 2 / 1 / 1 (na ordem da lista acima).
// Os nomes e as cores ficam no frontend; aqui só decidimos quem está em qual zona.
export type Zone = 'top' | 'good' | 'basic' | 'carry' | 'bleed' | 'uninstall'

// Com menos jogadores que isso não existe zona "Desinstala" (ninguém é o pior de 3).
const MIN_PLAYERS_FOR_LAST_ZONE = 4

// Fatias do miolo (posições entre o topo e o último): 25% bom trabalho, 40% básico, 20% empena, 15% sangria.
const GOOD_UNTIL = 0.25
const BASIC_UNTIL = 0.65
const CARRY_UNTIL = 0.85

export function zoneFor(position: number, total: number): Zone {
  if (position === 1) return 'top'

  const hasLastZone = total >= MIN_PLAYERS_FOR_LAST_ZONE
  if (hasLastZone && position === total) return 'uninstall'

  // O segundo colocado sempre é "bom trabalho".
  if (position === 2) return 'good'

  const middleCount = total - 1 - (hasLastZone ? 1 : 0)
  const fraction = (position - 2 + 0.5) / middleCount
  if (fraction < GOOD_UNTIL) return 'good'
  if (fraction < BASIC_UNTIL) return 'basic'
  if (fraction < CARRY_UNTIL) return 'carry'
  return 'bleed'
}
