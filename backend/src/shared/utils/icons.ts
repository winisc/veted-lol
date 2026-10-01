// Ícones 0–28 são os ícones de invocador padrão que toda conta tem.
// Quem não tem ícone da Riot salvo (ex.: chave da Riot desligada, bots) recebe um deles, fixo pelo id.
const DEFAULT_ICON_COUNT = 29

export function resolveIconId(userId: number, profileIconId: number | null | undefined): number {
  return profileIconId ?? userId % DEFAULT_ICON_COUNT
}
