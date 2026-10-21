import { useEffect, useState } from 'react'

// Campeões do LoL (nome em português e ícone), do Data Dragon da Riot. Carregado uma vez por sessão.
const DDRAGON = 'https://ddragon.leagueoflegends.com'

export interface Champion {
  id: string // ex.: "MonkeyKing" (é o que fica salvo)
  name: string // ex.: "Wukong"
}

interface ChampionData {
  version: string
  list: Champion[]
  byId: Map<string, Champion>
}

let cache: Promise<ChampionData> | null = null

function load(): Promise<ChampionData> {
  cache ??= (async () => {
    const versions = (await (await fetch(`${DDRAGON}/api/versions.json`)).json()) as string[]
    const version = versions[0]
    const data = (await (await fetch(`${DDRAGON}/cdn/${version}/data/pt_BR/champion.json`)).json()) as {
      data: Record<string, { id: string; name: string }>
    }
    const list = Object.values(data.data)
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return { version, list, byId: new Map(list.map((c) => [c.id, c])) }
  })().catch((err) => {
    cache = null // tenta de novo na próxima vez
    throw err
  })
  return cache
}

// Ícone quadrado do campeão. Sem a versão ainda (carregando), usa uma versão fixa recente.
export const championIconUrl = (id: string, version = '15.1.1') => `${DDRAGON}/cdn/${version}/img/champion/${id}.png`

export function useChampions() {
  const [data, setData] = useState<ChampionData | null>(null)
  useEffect(() => {
    let alive = true
    load()
      .then((d) => alive && setData(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return {
    champions: data?.list ?? [],
    nameOf: (id: string) => data?.byId.get(id)?.name ?? id,
    iconOf: (id: string) => championIconUrl(id, data?.version),
    ready: data !== null,
  }
}
