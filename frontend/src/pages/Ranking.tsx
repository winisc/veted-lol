import { Fragment } from "react";
import { YouBadge } from "../components/ui/Badges";
import Notice from "../components/ui/Notice";
import PageHero from "../components/ui/PageHero";
import ScoringRules from "../components/ui/ScoringRules";
import SummonerIcon from "../components/ui/SummonerIcon";
import { CrownIcon } from "../components/ui/icons";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { pageSplash } from "../lib/ddragon";
import { formatPercent } from "../lib/format";
import { splitRiotId } from "../lib/teams";
import { zoneOrder, zones, type Zone } from "../lib/zones";

interface RankingEntry {
  position: number;
  zone: Zone;
  userId: number;
  riotId: string;
  iconId: number;
  points: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
  mvps: number;
  bagres: number;
}

interface RankingResponse {
  scoring: { win: number; loss: number; mvp: number; bagre: number };
  ranking: RankingEntry[];
}

const COLUMNS = 9;

// Agrupa posições vizinhas da mesma zona (o backend já devolve o ranking em ordem).
function groupByZone(ranking: RankingEntry[]) {
  const groups: { zone: Zone; entries: RankingEntry[] }[] = [];
  for (const entry of ranking) {
    const last = groups[groups.length - 1];
    if (last && last.zone === entry.zone) last.entries.push(entry);
    else groups.push({ zone: entry.zone, entries: [entry] });
  }
  return groups;
}

// Pódio compacto dos 3 primeiros: cartões lado a lado (2º | 1º | 3º), o 1º em destaque dourado.
function Podium({ top, myId }: { top: RankingEntry[]; myId?: number }) {
  // No celular empilha na ordem 1, 2, 3; a partir de sm fica 2º | 1º | 3º.
  const smOrder: Record<number, string> = { 1: "sm:order-2", 2: "sm:order-1", 3: "sm:order-3" };

  return (
    <ol className="grid gap-2 sm:grid-cols-3 sm:items-end" aria-label="Pódio">
      {top.map((entry) => {
        const first = entry.position === 1;
        const zone = zones[entry.zone];
        const [name, tag] = splitRiotId(entry.riotId);
        return (
          <li
            key={entry.userId}
            className={`relative flex items-center gap-3 rounded-xl border px-4 ${smOrder[entry.position]} ${
              first
                ? "border-gold-200/50 bg-gold-200/[0.06] py-4"
                : "border-rim bg-abyss py-3"
            }`}
          >
            <span
              className={`w-7 shrink-0 text-center font-cond font-bold leading-none tabular-nums ${
                first ? "text-4xl text-gold-200" : "text-3xl text-ash"
              }`}
            >
              {entry.position}
            </span>
            <SummonerIcon
              iconId={entry.iconId}
              size={first ? "lg" : "md"}
              ring={first ? "gold" : "dim"}
              glow={first}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-display text-lg leading-tight text-gold-50">
                {first && <CrownIcon className="h-4 w-4 shrink-0 text-gold-200" />}
                <span className="truncate">{name}</span>
              </p>
              <p className="flex items-center gap-2 text-xs text-ash">
                <span>#{tag}</span>
                {entry.userId === myId && <YouBadge />}
              </p>
            </div>
            <p className="shrink-0 text-right">
              <span className={`block font-cond text-2xl font-bold leading-none tabular-nums ${zone.text}`}>
                {entry.points}
              </span>
              <span className="text-xs text-ash">pts</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export default function Ranking() {
  const { user } = useAuth();
  const { data, error, loading } = useApi<RankingResponse>("/ranking");

  if (loading) return <p className="text-ash">Carregando tabela...</p>;
  if (error || !data)
    return <Notice>{error || "Não foi possível carregar a tabela."}</Notice>;

  const { ranking, scoring } = data;
  const mine = ranking.find((entry) => entry.userId === user?.id);

  return (
    <div className="space-y-6">
      <PageHero
        splash={pageSplash.ranking}
        focus="object-[center_15%]"
        compact
        title="Tabela"
        subtitle={
          <>
            {mine ? (
              <span
                className={`block font-semibold ${zones[mine.zone].text}`}
              >
                Você está em #{mine.position} com {mine.points} pontos:{" "}
                {zones[mine.zone].label}.
              </span>
            ) : (
              <span className="block">
                Você ainda não está na tabela. Jogue uma partida para entrar.
              </span>
            )}
          </>
        }
      >
        <ScoringRules scoring={scoring} className="mt-2" />
      </PageHero>

      {ranking.length === 0 ? (
        <p className="border border-dashed border-rim px-4 py-12 text-center text-ash">
          Ninguém jogou ainda. A tabela aparece depois da primeira partida.
        </p>
      ) : (
        <>
          <Podium top={ranking.slice(0, 3)} myId={user?.id} />

          <ul className="flex flex-wrap gap-2" aria-label="Legenda das zonas">
            {zoneOrder.map((zone) => (
              <li
                key={zone}
                className={`bevel-sm px-3 py-1 text-xs font-semibold ${zones[zone].badge}`}
              >
                {zones[zone].symbol} {zones[zone].label}
              </li>
            ))}
          </ul>

          <div className="overflow-x-auto rounded-xl border border-rim">
            <table className="w-full min-w-152 text-left text-sm">
              <thead className="bg-abyss font-display text-sm text-gold-200">
                <tr>
                  <th className="px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3">Invocador</th>
                  <th className="px-3 py-3 text-right">Pontos</th>
                  <th className="px-3 py-3 text-right">Partidas</th>
                  <th className="px-3 py-3 text-right">V</th>
                  <th className="px-3 py-3 text-right">D</th>
                  <th className="px-3 py-3 text-right">Win rate</th>
                  <th className="px-3 py-3 text-right">MVPs</th>
                  <th className="px-3 py-3 text-right">Bagres</th>
                </tr>
              </thead>
              <tbody>
                {groupByZone(ranking).map(({ zone, entries }) => {
                  const style = zones[zone];
                  const first = entries[0].position;
                  const last = entries[entries.length - 1].position;
                  return (
                    <Fragment key={zone}>
                      <tr>
                        <td
                          colSpan={COLUMNS}
                          className={`px-3 py-2 font-display text-base ${style.header}`}
                        >
                          {style.symbol} {style.label}
                          <span className="ml-2 font-sans text-xs opacity-70">
                            {first === last
                              ? `#${first}`
                              : `#${first} a #${last}`}
                          </span>
                        </td>
                      </tr>

                      {entries.map((entry) => {
                        const isMe = entry.userId === user?.id;
                        const [name, tag] = splitRiotId(entry.riotId);
                        return (
                          <tr
                            key={entry.userId}
                            className={`border-t border-void/60 ${style.row} ${isMe ? "outline-1 -outline-offset-1 outline-hex-300/70" : ""}`}
                          >
                            <td
                              className={`border-l-4 px-3 py-2.5 text-center font-cond text-lg font-bold tabular-nums ${style.bar} ${style.text}`}
                            >
                              {entry.position}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex min-w-0 items-center gap-3">
                                <SummonerIcon
                                  iconId={entry.iconId}
                                  size="sm"
                                  ring={style.ring}
                                />
                                <div className="min-w-0">
                                  <p
                                    className={`flex items-center gap-2 truncate text-gold-50 ${isMe ? "font-bold" : "font-semibold"}`}
                                  >
                                    <span className="truncate">{name}</span>
                                    {isMe && <YouBadge />}
                                  </p>
                                  <p className="text-xs text-ash">#{tag}</p>
                                </div>
                              </div>
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right font-cond text-xl font-bold tabular-nums ${style.text}`}
                            >
                              {entry.points}
                            </td>
                            <td className="px-3 py-2.5 text-right font-cond text-base tabular-nums text-gold-50/80">
                              {entry.games}
                            </td>
                            <td className="px-3 py-2.5 text-right font-cond text-base tabular-nums text-hex-300">
                              {entry.wins}
                            </td>
                            <td className="px-3 py-2.5 text-right font-cond text-base tabular-nums text-team-red">
                              {entry.losses}
                            </td>
                            <td className="px-3 py-2.5 text-right font-cond text-base tabular-nums text-gold-50/80">
                              {formatPercent(entry.winRate)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-cond text-base tabular-nums text-gold-200">
                              {entry.mvps}
                            </td>
                            <td className="px-3 py-2.5 text-right font-cond text-base tabular-nums text-bagre">
                              {entry.bagres ?? 0}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
