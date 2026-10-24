// Lista oficial de campeões do LoL (Data Dragon da Riot): id (ex.: "MonkeyKing", o mesmo dos ícones) e nome.
// Usada na seleção de campeões do lobby e na leitura do print da pancada. Carregada uma vez e guardada em memória.
const DDRAGON = process.env.DDRAGON_HOST || 'https://ddragon.leagueoflegends.com'

export interface Champion {
  id: string
  name: string
}

let loading: Promise<Champion[]> | null = null
let loaded: Champion[] | null = null

export function championList(): Promise<Champion[]> {
  loading ??= (async () => {
    const versions = (await (await fetch(`${DDRAGON}/api/versions.json`)).json()) as string[]
    const data = (await (await fetch(`${DDRAGON}/cdn/${versions[0]}/data/en_US/champion.json`)).json()) as {
      data: Record<string, Champion>
    }
    loaded = Object.values(data.data).map((c) => ({ id: c.id, name: c.name }))
    return loaded
  })().catch((err) => {
    loading = null
    throw err
  })
  return loading
}

// Já carregada (para usar sem esperar); null enquanto ainda não chegou.
export function knownChampions(): Champion[] | null {
  return loaded
}

// Carrega em segundo plano (ex.: ao abrir um lobby), sem travar nada se a Riot não responder.
export function warmChampions() {
  championList().catch(() => {})
}

const ID = /^[A-Za-z0-9]{2,30}$/

// Campeão válido: está na lista oficial (ou, se ela ainda não carregou, tem o formato de um id).
export function isChampionId(value: unknown): value is string {
  if (typeof value !== 'string' || !ID.test(value)) return false
  return loaded ? loaded.some((c) => c.id === value) : true
}
