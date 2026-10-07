import { Fragment, useState } from "react";
import { YouBadge } from "../components/ui/Badges";
import Notice from "../components/ui/Notice";
import PageHero from "../components/ui/PageHero";
import PlayerLink from "../components/ui/PlayerLink";
import ScoringRules from "../components/ui/ScoringRules";
import SummonerIcon from "../components/ui/SummonerIcon";
import { CrownIcon, FishIcon, StarIcon } from "../components/ui/icons";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { pageSplash } from "../lib/ddragon";
import SeasonCountdown from "../components/SeasonCountdown";
import { formatDate, formatPercent } from "../lib/format";
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

interface SeasonInfo {
  id: number;
  startsAt: string;
  endsAt: string;
  current: boolean;
  legacy: boolean; // a tabela antiga, de antes das seasons
}

interface RankingResponse {
  scoring: { win: number; loss: number; mvp: number; bagre: number };
  ranking: RankingEntry[];
  season?: SeasonInfo; // ausente em servidores antigos
  seasons?: SeasonInfo[];
  now?: number;
}

const seasonLabel = (s: SeasonInfo) => `Season ${s.id}`;

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
                <PlayerLink userId={entry.userId} className="truncate">{name}</PlayerLink>
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

// Destaques da tabela, estilo "prêmio": o líder em evidência (ícone grande, nome e contagem)
// e os dois seguintes numa linha discreta embaixo. Só entra quem tem pelo menos 1.
const awards = [
  {
    key: "mvps",
    title: "Rei do MVP",
    unit: (n: number) => (n === 1 ? "MVP" : "MVPs"),
    empty: "Ninguém foi MVP ainda.",
    Icon: StarIcon,
    text: "text-gold-200",
    bar: "bg-gold-200",
    medal: "bg-gold-200 text-void",
    ring: "gold",
  },
  {
    key: "bagres",
    title: "Rei do bagre",
    unit: (n: number) => (n === 1 ? "bagre" : "bagres"),
    empty: "Ninguém foi bagre ainda.",
    Icon: FishIcon,
    text: "text-bagre",
    bar: "bg-bagre",
    medal: "bg-bagre text-void",
    ring: "bagre",
  },
] as const;

function AwardLeaders({ ranking, myId }: { ranking: RankingEntry[]; myId?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {awards.map(({ key, title, unit, empty, Icon, text, bar, medal, ring }) => {
        // Empate: quem jogou menos partidas fica na frente (mais por jogo).
        const leaders = ranking
          .filter((e) => (e[key] ?? 0) > 0)
          .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0) || a.games - b.games)
          .slice(0, 3);
        const [leader, ...rest] = leaders;
        const count = leader ? (leader[key] ?? 0) : 0;
        const [name, tag] = leader ? splitRiotId(leader.riotId) : ["", ""];

        return (
          <section key={key} className="relative overflow-hidden rounded-xl border border-rim bg-abyss">
            <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
            <div className="flex items-center gap-4 py-3 pl-5 pr-4">
              {leader ? (
                <SummonerIcon
                  iconId={leader.iconId}
                  size="lg"
                  ring={ring}
                  badge={
                    <span className={`grid h-5 w-5 place-items-center rounded-full ${medal}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                  }
                />
              ) : (
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border border-dashed border-rim ${text}`}>
                  <Icon className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${text}`}>
                  <Icon className="h-3.5 w-3.5" /> {title}
                </p>
                {leader ? (
                  <>
                    <p className="flex items-center gap-2 truncate font-display text-2xl leading-tight text-gold-50">
                      <PlayerLink userId={leader.userId} className="truncate">{name}</PlayerLink>
                      {leader.userId === myId && <YouBadge />}
                    </p>
                    <p className="text-xs text-ash">#{tag}</p>
                  </>
                ) : (
                  <p className="mt-0.5 text-sm text-ash">{empty}</p>
                )}
              </div>
              {leader && (
                <p className="shrink-0 text-right">
                  <span className={`block font-cond text-4xl font-bold leading-none tabular-nums ${text}`}>{count}</span>
                  <span className="text-xs text-ash">{unit(count)}</span>
                </p>
              )}
            </div>

            {rest.length > 0 && (
              <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rim py-2 pl-5 pr-4 text-sm">
                {rest.map((entry, i) => (
                  <li key={entry.userId} className="flex min-w-0 items-center gap-1.5">
                    <span className="font-cond font-bold text-ash-dim">{i + 2}º</span>
                    <SummonerIcon iconId={entry.iconId} size="xs" ring="dim" />
                    <PlayerLink userId={entry.userId} className="truncate font-semibold text-gold-50">{splitRiotId(entry.riotId)[0]}</PlayerLink>
                    <span className={`font-cond font-bold tabular-nums ${text}`}>{entry[key]}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function Ranking() {
  const { user } = useAuth();
  // null = a season atual. Ao trocar, a tabela anterior continua na tela até a nova chegar.
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const { data, error, loading } = useApi<RankingResponse>(seasonId === null ? "/ranking" : `/ranking?season=${seasonId}`);

  if (loading && !data) return <p className="text-ash">Carregando tabela...</p>;
  if (error || !data)
    return <Notice>{error || "Não foi possível carregar a tabela."}</Notice>;

  const { ranking, scoring, season, seasons } = data;
  const mine = ranking.find((entry) => entry.userId === user?.id);
  // Season encerrada: tabela congelada, só para consulta.
  const past = season !== undefined && !season.current;

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
                {past ? "Você terminou" : "Você está"} em #{mine.position} com {mine.points} pontos:{" "}
                {zones[mine.zone].label}.
              </span>
            ) : (
              <span className="block">
                {past
                  ? "Você não jogou nesta season."
                  : "Você ainda não está na tabela. Jogue uma partida para entrar."}
              </span>
            )}
          </>
        }
      >
        {season && data.now !== undefined && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-rim px-2 py-0.5 text-xs font-semibold text-gold-50">{seasonLabel(season)}</span>
            {season.current ? (
              <SeasonCountdown key={season.endsAt} endsAt={season.endsAt} now={data.now} />
            ) : (
              <span className="text-xs text-ash">
                {season.legacy
                  ? `Tudo o que foi jogado até ${formatDate(season.endsAt)}`
                  : `${formatDate(season.startsAt)} a ${formatDate(season.endsAt)} · encerrada`}
              </span>
            )}
          </div>
        )}
        <ScoringRules scoring={scoring} className="mt-2" />
      </PageHero>

      {/* Seasons: a atual e as encerradas (tabela final guardada) */}
      {seasons && seasons.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seasons">
          {seasons.map((s) => {
            const active = (season?.id ?? seasons[0].id) === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSeasonId(s.current ? null : s.id)}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "border-gold-200 bg-gold-200/15 text-gold-50"
                    : "border-rim bg-abyss text-ash hover:border-ash-dim hover:text-gold-50"
                }`}
              >
                {seasonLabel(s)}
                {s.current && <span className="ml-1.5 text-xs font-normal text-hex-300">Atual</span>}
              </button>
            );
          })}
        </div>
      )}

      {ranking.length === 0 ? (
        <p className="border border-dashed border-rim px-4 py-12 text-center text-ash">
          {past
            ? "Ninguém jogou nesta season."
            : "Ninguém jogou nesta season ainda. A tabela aparece depois da primeira partida."}
        </p>
      ) : (
        <>
          <Podium top={ranking.slice(0, 3)} myId={user?.id} />
          <AwardLeaders ranking={ranking} myId={user?.id} />

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
                                    <PlayerLink userId={entry.userId} className="truncate">{name}</PlayerLink>
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
