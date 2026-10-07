import type { LobbyPlayer, Side } from '../hooks/useLobby'
import { sideStyle } from '../lib/teams'
import { BagreBadge, CaptainBadge, MvpBadge, YouBadge } from './ui/Badges'
import { useProfilePath } from './ui/PlayerLink'
import PlayerRow from './ui/PlayerRow'
import RoleIcons from './ui/RoleIcons'

interface Props {
  side: Side
  members: LobbyPlayer[]
  slots?: number // mostra vagas vazias até esse total ("Aguardando pick...")
  mvpId?: number | null
  bagreId?: number | null
  winner?: boolean
  title?: string
}

export default function TeamCard({ side, members, slots, mvpId, bagreId, winner, title }: Props) {
  const style = sideStyle[side]
  const profilePath = useProfilePath()
  const rows = Array.from({ length: Math.max(slots ?? 0, members.length) }, (_, i) => members[i])

  return (
    <div className={`overflow-hidden rounded-lg border bg-abyss ${winner ? 'border-gold-200/60' : 'border-rim'}`}>
      <header className="flex items-center justify-between gap-2 border-b border-rim px-3 py-2">
        <h3 className="flex items-center gap-2 font-display text-base text-gold-50">
          <span className={`h-2.5 w-2.5 rounded-full ${style.bar}`} aria-hidden="true" />
          {title ?? style.name}
        </h3>
        {winner && <span className="rounded bg-gold-200 px-2 py-0.5 text-xs font-semibold text-void">Vitória</span>}
      </header>
      <ul className="space-y-1 p-1.5">
        {rows.map((member, i) =>
          member ? (
            <li key={member.id}>
              <PlayerRow
                riotId={member.riotId}
                iconId={member.iconId}
                ring={member.id === mvpId ? 'gold' : member.id === bagreId ? 'bagre' : style.ring}
                highlight={member.isYou}
                to={profilePath(member.id)}
                newTab
                fullName
                hideTag
                right={<RoleIcons roles={member.roles} />}
                badges={
                  <>
                    {member.isCaptain && <CaptainBadge />}
                    {member.id === mvpId && <MvpBadge />}
                    {member.id === bagreId && <BagreBadge />}
                    {member.isYou && <YouBadge />}
                  </>
                }
              />
            </li>
          ) : (
            <li key={`empty-${i}`} className="flex items-center gap-2.5 rounded-md border border-dashed border-rim px-2.5 py-1.5">
              <span className="h-9 w-9 shrink-0 rounded-full border border-dashed border-ash-dim" />
              <span className="text-sm text-ash-dim">Aguardando pick...</span>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
