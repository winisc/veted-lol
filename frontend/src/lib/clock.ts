// Diferença entre o relógio do servidor e o do navegador, para as contagens regressivas baterem com o servidor.
//
// Cada atualização traz a hora do servidor; a diferença medida é (hora do servidor - hora em que chegou aqui), que
// fica menor quanto mais a atualização demorou para chegar. Por isso vale a MAIOR medida (a da atualização mais rápida):
// uma atualização atrasada não faz a tela achar que ainda sobra tempo. Se o relógio do computador mudar de verdade
// (diferença muito maior ou menor que a guardada), recomeça com a medida nova.
const JUMP_MS = 30_000

export function nextSkew(previous: number | null, serverNow: number): number {
  const sample = serverNow - Date.now()
  if (previous === null || Math.abs(sample - previous) > JUMP_MS) return sample
  return Math.max(previous, sample)
}
