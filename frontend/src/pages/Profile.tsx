import ProfileRoles from "../components/ProfileRoles";
import Notice from "../components/ui/Notice";
import Panel from "../components/ui/Panel";
import ScoringRules from "../components/ui/ScoringRules";
import SummonerIcon from "../components/ui/SummonerIcon";
import { CrownIcon, FishIcon, StarIcon } from "../components/ui/icons";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
  Link,
} from "react-router-dom";
import ProfileExtra, {
  type ProfileExtraData,
} from "../components/ProfileExtra";
import ProfileSeasons, {
  type SeasonResult,
} from "../components/ProfileSeasons";
import SeasonCountdown from "../components/SeasonCountdown";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { profileSplash } from "../lib/ddragon";
import {
  formatDate,
  formatDateTime,
  formatPercent,
  signed,
} from "../lib/format";
import { formatDuration, splitRiotId } from "../lib/teams";
import type { PlayerRoles } from "../lib/roles";
import { zones, type Zone } from "../lib/zones";

type Result = "win" | "loss" | "remake";

interface ProfileResponse {
  user: {
    id: number;
    riotId: string;
    iconId: number;
    createdAt: string;
    roles?: PlayerRoles;
  };
  stats: {
    points: number;
    games: number;
    wins: number;
    losses: number;
    winRate: number | null;
    mvps: number;
    bagres: number;
    rank: number | null;
    zone: Zone | null;
    rankedPlayers: number;
  };
  history: {
    matchId: string;
    endedAt: string;
    durationSeconds: number;
    side: "blue" | "red";
    result: Result;
    isCaptain: boolean;
    isMvp: boolean;
    isBagre: boolean;
    points: number;
    seasonId?: number;
  }[];
  scoring: { win: number; loss: number; mvp: number; bagre: number };
  extra?: ProfileExtraData; // ausente em servidores antigos
  season?: { id: number; startsAt: string; endsAt: string; now: number }; // season atual (ausente em servidores antigos)
  seasons?: SeasonResult[];
}

// Cores do histórico como no LoL: vitória em ciano, derrota em vermelho.
const resultStyle: Record<
  Result,
  { label: string; bar: string; text: string }
> = {
  win: { label: "Vitória", bar: "bg-hex-300", text: "text-hex-300" },
  loss: { label: "Derrota", bar: "bg-team-red", text: "text-team-red" },
  remake: { label: "Remake", bar: "bg-ash-dim", text: "text-ash" },
};

// Anel de win rate (vitórias em ciano sobre o total).
function WinRateRing({ value }: { value: number | null }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = value ?? 0;
  return (
    <div className="relative grid h-36 w-36 place-items-center">
      <svg
        viewBox="0 0 120 120"
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#E84057"
          strokeOpacity={value === null ? 0 : 0.55}
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#1E2D3D"
          strokeOpacity={value === null ? 1 : 0}
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#0AC8B9"
          strokeWidth="8"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <div className="text-center">
        <p className="font-cond text-3xl font-bold leading-none tabular-nums text-gold-50">
          {formatPercent(value)}
        </p>
        <p className="mt-1 text-xs text-ash">win rate</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-gold-50",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="border-l border-rim pl-4">
      <p className="text-sm text-ash">{label}</p>
      <p
        className={`font-cond text-4xl font-bold leading-tight tabular-nums ${tone}`}
      >
        {value}
      </p>
    </div>
  );
}

// Pontos da tabela depois de cada partida (remakes não mexem nos pontos e ficam de fora), do mais antigo ao
// mais novo. Parte dos pontos de agora e volta no histórico (que vem do mais recente para o mais antigo).
function pointsEvolution(
  history: ProfileResponse["history"],
  currentPoints: number,
): number[] {
  const played = history.filter((m) => m.result !== "remake").reverse();
  let points = currentPoints - played.reduce((sum, m) => sum + m.points, 0);
  return [points, ...played.map((m) => (points += m.points))];
}

export default function Profile() {
  // /perfil é o meu; /jogador/:id é o de outra pessoa (somente leitura).
  const { id } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const viewingOther = id !== undefined && Number(id) !== me?.id;
  const { data, error, loading } = useApi<ProfileResponse>(
    viewingOther ? `/profile/${id}` : "/profile",
  );
  // Veio do aviso da fila (?tour=roles): destaca onde definir as roles até o jogador salvar.
  const [searchParams, setSearchParams] = useSearchParams();
  const rolesTour = searchParams.get("tour") === "roles";
  const endTour = () => setSearchParams({}, { replace: true });

  if (id !== undefined && !viewingOther)
    return <Navigate to="/perfil" replace />;
  if (loading) return <p className="text-ash">Carregando perfil...</p>;
  if (error || !data)
    return <Notice>{error || "Não foi possível carregar o perfil."}</Notice>;

  const { user, stats, history, scoring, extra, season, seasons } = data;
  const [name, tag] = splitRiotId(user.riotId);
  const zone = stats.zone ? zones[stats.zone] : null;
  const pointsTone = stats.points < 0 ? "text-team-red" : "text-gold-200";

  return (
    <div className="space-y-6">
      {viewingOther && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-mb-3 text-sm text-ash transition-colors hover:text-gold-50"
        >
          ← Voltar
        </button>
      )}

      {/* Banner com splash art e o ícone de invocador em destaque */}
      <section className="relative isolate overflow-hidden rounded-xl border border-rim bg-abyss">
        <img
          src={profileSplash(user.id)}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%] opacity-60"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-void via-void/70 to-void/10"
        />
        <div className="flex flex-col items-center gap-5 px-6 pb-8 pt-20 text-center sm:flex-row sm:items-end sm:pt-28 sm:text-left">
          <SummonerIcon
            iconId={user.iconId}
            size="2xl"
            ring={zone?.ring === "red" ? "red" : "gold"}
            glow
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-4xl text-gold-50 sm:text-5xl">
              {name}
            </h1>
            <p className="text-lg text-ash">#{tag}</p>
            <p className="mt-1 text-sm text-ash">
              Jogando desde {formatDate(user.createdAt)}
            </p>
            <ProfileRoles
              key={user.id}
              initial={user.roles}
              tour={rolesTour && !viewingOther}
              onSaved={endTour}
              readOnly={viewingOther}
            />
            {seasons && seasons.length > 0 && (
              <ProfileSeasons seasons={seasons} />
            )}
          </div>
          <div className="flex flex-col items-center gap-2 sm:items-end">
            {stats.rank && zone ? (
              <>
                <p
                  className={`font-cond text-5xl font-bold leading-none ${zone.text}`}
                >
                  #{stats.rank}
                </p>
                <p className="text-sm text-ash">
                  de {stats.rankedPlayers} na tabela
                  {season ? ` da Season ${season.id}` : ""}
                </p>
                <span
                  className={`bevel-sm px-3 py-1 text-sm font-bold ${zone.badge}`}
                >
                  {zone.symbol} {zone.label}
                </span>
              </>
            ) : (
              <p className="max-w-48 text-sm text-ash">
                Sem posição na tabela ainda. Jogue uma partida.
              </p>
            )}
          </div>
        </div>
      </section>

      <Panel
        title={season ? `Estatísticas · Season ${season.id}` : "Estatísticas"}
        action={
          season && (
            <SeasonCountdown
              key={season.endsAt}
              endsAt={season.endsAt}
              now={season.now}
            />
          )
        }
      >
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <WinRateRing value={stats.winRate} />
          <div className="grid w-full flex-1 grid-cols-3 gap-x-4 gap-y-5 md:grid-cols-6">
            <Stat label="Pontos" value={stats.points} tone={pointsTone} />
            <Stat label="Partidas" value={stats.games} />
            <Stat label="Vitórias" value={stats.wins} tone="text-hex-300" />
            <Stat label="Derrotas" value={stats.losses} tone="text-team-red" />
            <Stat label="MVPs" value={stats.mvps} tone="text-gold-200" />
            <Stat label="Bagres" value={stats.bagres ?? 0} tone="text-bagre" />
          </div>
        </div>
        <ScoringRules
          scoring={scoring}
          className="mt-5 border-t border-rim pt-4"
        />
      </Panel>

      {extra && (
        <ProfileExtra
          extra={extra}
          // Os pontos são da season atual: a curva só usa as partidas dela.
          evolution={pointsEvolution(
            season ? history.filter((m) => m.seasonId === season.id) : history,
            stats.points,
          )}
        />
      )}

      <Panel
        title={viewingOther ? "Partidas recentes" : "Histórico de partidas"}
        bodyClassName="p-3"
      >
        {history.length === 0 ? (
          <p className="p-4 text-center text-ash">
            {viewingOther
              ? "Esse jogador ainda não jogou nenhuma partida."
              : "Nenhuma partida ainda. Entre na fila pela aba Jogar."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((match) => {
              const style = resultStyle[match.result];
              return (
                <li key={match.matchId}>
                  <Link
                    to={`/partida/${match.matchId}`}
                    title="Ver a partida"
                    className="flex items-stretch overflow-hidden rounded-md bg-panel transition-colors hover:bg-rim"
                  >
                    <span
                      className={`w-1 shrink-0 ${style.bar}`}
                      aria-hidden="true"
                    />
                    <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3">
                      <div className="w-24">
                        <p className={`font-display text-lg ${style.text}`}>
                          {style.label}
                        </p>
                        <p className="font-cond text-sm tabular-nums text-ash">
                          {formatDuration(match.durationSeconds)}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1.5 text-gold-50">
                            <span
                              className={`h-2 w-2 rounded-full ${match.side === "blue" ? "bg-team-blue" : "bg-team-red"}`}
                            />
                            {match.side === "blue"
                              ? "Lado azul"
                              : "Lado vermelho"}
                          </span>
                          {match.isCaptain && (
                            <span className="flex items-center gap-1 text-gold-200">
                              <CrownIcon className="h-3.5 w-3.5" /> Capitão
                            </span>
                          )}
                          {match.isMvp && (
                            <span className="flex items-center gap-1 font-semibold text-gold-200">
                              <StarIcon className="h-3.5 w-3.5" /> MVP
                            </span>
                          )}
                          {match.isBagre && (
                            <span className="flex items-center gap-1 font-semibold text-bagre">
                              <FishIcon className="h-3.5 w-3.5" /> Bagre
                            </span>
                          )}
                        </p>
                        <p className="text-ash">
                          {formatDateTime(match.endedAt)}
                        </p>
                      </div>
                      <span
                        className={`font-cond text-2xl font-bold tabular-nums ${style.text}`}
                      >
                        {signed(match.points)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
