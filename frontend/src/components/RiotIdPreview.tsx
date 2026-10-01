import type { RiotLookupState } from '../hooks/useRiotLookup'
import SummonerIcon from './ui/SummonerIcon'

export default function RiotIdPreview({ lookup }: { lookup: RiotLookupState }) {
  if (lookup.status === 'idle') return null

  return (
    <div aria-live="polite" className="flex min-h-16 items-center gap-3 border border-rim bg-abyss/80 px-3 py-2">
      {lookup.status === 'loading' && (
        <>
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-rim border-t-hex-300" />
          <span className="text-sm text-ash">Buscando invocador...</span>
        </>
      )}

      {lookup.status === 'found' && (
        <>
          <SummonerIcon iconId={lookup.player.profileIconId} size="md" ring="gold" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-gold-50">
              {lookup.player.gameName}
              <span className="font-normal text-ash"> #{lookup.player.tagLine}</span>
            </p>
            <p className="text-xs text-ash">Nível {lookup.player.summonerLevel} · servidor BR</p>
          </div>
          <span className="text-sm font-semibold text-hex-300">Encontrado</span>
        </>
      )}

      {lookup.status === 'notfound' && <span className="text-sm text-rose-300">{lookup.message}</span>}

      {lookup.status === 'unavailable' && <span className="text-sm text-gold-200">{lookup.message}</span>}
    </div>
  )
}
