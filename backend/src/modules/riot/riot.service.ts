import { AppError } from '../../shared/errors/AppError'
import { formatRiotId, type RiotId } from '../../shared/utils/riotId'
import type { PlayerProfile } from './riot.types'

// Só região BR. Para trocar, altere aqui (account-v1 usa o cluster regional, summoner-v4 a plataforma).
const ACCOUNT_HOST = 'https://americas.api.riotgames.com'
const PLATFORM_HOST = 'https://br1.api.riotgames.com'
const DDRAGON = 'https://ddragon.leagueoflegends.com'

const LOOKUP_TTL_MS = 5 * 60 * 1000
const VERSION_TTL_MS = 60 * 60 * 1000

interface RiotAccountDto {
  puuid: string
  gameName: string
  tagLine: string
}

interface RiotSummonerDto {
  profileIconId: number
  summonerLevel: number
}

const lookupCache = new Map<string, { value: PlayerProfile; expires: number }>()
let versionCache: { value: string; expires: number } | null = null

async function riotFetch<T>(url: string): Promise<T> {
  const key = process.env.RIOT_API_KEY
  if (!key) throw new AppError('Integração com a Riot não configurada.', 503)

  let res: Response
  try {
    res = await fetch(url, { headers: { 'X-Riot-Token': key } })
  } catch {
    throw new AppError('Não foi possível falar com a Riot. Tente novamente.', 502)
  }

  if (res.ok) return (await res.json()) as T
  if (res.status === 404) throw new AppError('Jogador não encontrado no servidor BR.', 404)
  if (res.status === 401 || res.status === 403) {
    console.error('Riot API rejeitou a chave (inválida ou expirada).')
    throw new AppError('Integração com a Riot indisponível (chave inválida ou expirada).', 503)
  }
  if (res.status === 429) throw new AppError('Muitas consultas à Riot. Tente novamente em instantes.', 429)
  throw new AppError('Erro ao consultar a Riot. Tente novamente.', 502)
}

async function getDataDragonVersion(): Promise<string> {
  if (versionCache && versionCache.expires > Date.now()) return versionCache.value

  try {
    const res = await fetch(`${DDRAGON}/api/versions.json`)
    if (!res.ok) throw new Error(`status ${res.status}`)
    const versions = (await res.json()) as string[]
    versionCache = { value: versions[0], expires: Date.now() + VERSION_TTL_MS }
    return versionCache.value
  } catch {
    if (versionCache) return versionCache.value
    throw new AppError('Não foi possível carregar o ícone do jogador.', 502)
  }
}

export const riotService = {
  isConfigured() {
    return Boolean(process.env.RIOT_API_KEY)
  },

  async lookup({ gameName, tagLine }: RiotId): Promise<PlayerProfile> {
    const cacheKey = `${gameName}#${tagLine}`.toLowerCase()
    const cached = lookupCache.get(cacheKey)
    if (cached && cached.expires > Date.now()) return cached.value

    const account = await riotFetch<RiotAccountDto>(
      `${ACCOUNT_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    )
    const summoner = await riotFetch<RiotSummonerDto>(
      `${PLATFORM_HOST}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
    )
    const version = await getDataDragonVersion()

    const profile: PlayerProfile = {
      riotId: formatRiotId(account.gameName, account.tagLine),
      gameName: account.gameName,
      tagLine: account.tagLine,
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
      iconUrl: `${DDRAGON}/cdn/${version}/img/profileicon/${summoner.profileIconId}.png`,
    }

    lookupCache.set(cacheKey, { value: profile, expires: Date.now() + LOOKUP_TTL_MS })
    return profile
  },
}
