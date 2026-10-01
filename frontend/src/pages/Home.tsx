import { Link, useLocation } from "react-router-dom";
import QueuePanel from "../components/QueuePanel";
import Notice from "../components/ui/Notice";
import PageHero from "../components/ui/PageHero";
import Panel from "../components/ui/Panel";
import PlayerRow from "../components/ui/PlayerRow";
import SummonerIcon from "../components/ui/SummonerIcon";
import { StarIcon } from "../components/ui/icons";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { pageSplash } from "../lib/ddragon";
import { formatPercent } from "../lib/format";
import { zones, type Zone } from "../lib/zones";

interface RankingEntry {
  position: number;
  zone: Zone;
  userId: number;
  riotId: string;
  iconId: number;
  points: number;
}

interface RankingResponse {
  ranking: RankingEntry[];
}

type Result = "win" | "loss" | "remake";

interface ProfileResponse {
  user: { id: number; riotId: string; iconId: number };
  stats: {
    points: number;
    games: number;
    wins: number;
    losses: number;
    winRate: number | null;
    mvps: number;
    rank: number | null;
    zone: Zone | null;
    rankedPlayers: number;
  };
  history: { matchId: string; result: Result; isMvp: boolean }[];
}

// O caminho de uma partida, na ordem em que acontece.
const steps = [
  { title: "Fila", text: "10 jogadores entram e a partida é montada." },
  {
    title: "Capitães",
    text: "Todos votam; os 2 mais votados lideram os times.",
  },
  { title: "Draft", text: "Sorteio, escolha de lado e picks 1-2-2-2-1." },
  { title: "Partida", text: "Cronômetro rolando; 6 votos encerram o jogo." },
  {
    title: "Resultado",
    text: "Votação do vencedor e do MVP. Pontos na tabela.",
  },
];

// Cores das últimas partidas, como no histórico do LoL.
const formStyle: Record<Result, { label: string; classes: string }> = {
  win: { label: "V", classes: "border-hex-300/60 bg-hex-900/60 text-hex-300" },
  loss: {
    label: "D",
    classes: "border-team-red/60 bg-team-red/15 text-team-red",
  },
  remake: { label: "R", classes: "border-rim bg-rim/40 text-ash" },
};

const FORM_SIZE = 5;

// Quantos pontos faltam para subir uma posição (ou a vantagem de quem lidera).
function pointsGoal(
  ranking: RankingEntry[] | undefined,
  rank: number | null,
  points: number,
) {
  if (!ranking || !rank) return null;
  if (rank === 1) {
    const second = ranking[1];
    return second
      ? `Liderando com ${points - second.points} pts de vantagem`
      : "Liderando a tabela";
  }
  const above = ranking[rank - 2];
  if (!above) return null;
  const gap = above.points - points;
  return gap > 0
    ? `Faltam ${gap} pts para o #${rank - 1}`
    : `Empatado em pontos com o #${rank - 1}`;
}

function MyRecord({ ranking }: { ranking?: RankingEntry[] }) {
  const { data } = useApi<ProfileResponse>("/profile");

  return (
    <Panel
      title="Seu desempenho"
      className="flex flex-col"
      bodyClassName="flex flex-1 flex-col p-5"
      action={
        <Link to="/perfil" className="text-sm text-gold-200 hover:text-gold-50">
          Ver perfil
        </Link>
      }
    >
      {!data ? (
        <p className="text-ash">Carregando...</p>
      ) : data.stats.games === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
          <SummonerIcon iconId={data.user.iconId} size="lg" ring="dim" />
          <p className="text-ash">
            Jogue sua primeira partida para entrar na tabela.
          </p>
        </div>
      ) : (
        <RecordBody data={data} ranking={ranking} />
      )}
    </Panel>
  );
}

function RecordBody({
  data,
  ranking,
}: {
  data: ProfileResponse;
  ranking?: RankingEntry[];
}) {
  const { stats, user, history } = data;
  const zone = stats.zone ? zones[stats.zone] : null;
  const decided = stats.wins + stats.losses;
  const winShare = decided === 0 ? 0 : (stats.wins / decided) * 100;
  const goal = pointsGoal(ranking, stats.rank, stats.points);
  const form = history.slice(0, FORM_SIZE);

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* Quem é e onde está na tabela */}
      <div className="flex items-center gap-4">
        <SummonerIcon
          iconId={user.iconId}
          size="lg"
          ring={zone?.ring ?? "gold"}
          glow={stats.zone === "top"}
        />
        <div className="min-w-0">
          {stats.rank && (
            <p className="font-cond text-3xl font-bold leading-none tabular-nums text-gold-50">
              #{stats.rank}
              <span className="ml-1.5 text-base font-semibold text-ash">
                de {stats.rankedPlayers}
              </span>
            </p>
          )}
          {zone && (
            <span
              className={`bevel-sm mt-1.5 inline-block px-2.5 py-0.5 text-xs font-bold ${zone.badge}`}
            >
              {zone.symbol} {zone.label}
            </span>
          )}
        </div>
      </div>

      {/* Pontos e o próximo objetivo */}
      <div>
        <p className="flex items-baseline gap-2">
          <span
            className={`font-cond text-5xl font-bold leading-none tabular-nums ${
              stats.points < 0 ? "text-team-red" : "text-gold-50"
            }`}
          >
            {stats.points}
          </span>
          <span className="text-sm text-ash">pontos</span>
        </p>
        {goal && <p className="mt-1 text-sm text-gold-200">{goal}</p>}
      </div>

      {/* Vitórias x derrotas */}
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-cond text-lg font-semibold text-hex-300">
            {stats.wins}V
          </span>
          <span className="text-ash">
            Win rate{" "}
            <span className="font-cond text-lg font-semibold text-gold-50">
              {formatPercent(stats.winRate)}
            </span>
          </span>
          <span className="font-cond text-lg font-semibold text-team-red">
            {stats.losses}D
          </span>
        </div>
        <div
          className="mt-1 flex h-2 overflow-hidden rounded-full bg-team-red/70"
          role="img"
          aria-label={`${stats.wins} vitórias e ${stats.losses} derrotas`}
        >
          <div
            className="h-full bg-hex-300"
            style={{ width: `${winShare}%` }}
          />
        </div>
      </div>

      {/* Últimas partidas + MVPs */}
      <div className="mt-auto flex items-end justify-between gap-4 border-t border-rim pt-4">
        <div>
          <p className="mb-1.5 text-xs text-ash">Últimas partidas</p>
          <ol
            className="flex gap-1.5"
            aria-label="Últimas partidas, da mais recente para a mais antiga"
          >
            {form.map((match) => (
              <li
                key={match.matchId}
                title={match.isMvp ? "MVP" : undefined}
                className={`relative grid h-8 w-8 place-items-center rounded-md border font-cond text-base font-bold ${formStyle[match.result].classes}`}
              >
                {formStyle[match.result].label}
                {match.isMvp && (
                  <StarIcon className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 text-gold-200" />
                )}
              </li>
            ))}
          </ol>
        </div>
        <div className="text-right">
          <p className="text-xs text-ash">MVPs</p>
          <p className="flex items-center justify-end gap-1 font-cond text-3xl font-bold leading-none text-gold-200">
            <StarIcon className="h-5 w-5" />
            {stats.mvps}
          </p>
        </div>
      </div>
    </div>
  );
}

function TopRanking({ ranking }: { ranking?: RankingEntry[] }) {
  const { user } = useAuth();
  const top = ranking?.slice(0, 5) ?? [];

  return (
    <Panel
      title="Topo da tabela"
      action={
        <Link to="/tabela" className="text-sm text-gold-200 hover:text-gold-50">
          Ver tabela
        </Link>
      }
      bodyClassName="p-3"
    >
      {!ranking ? (
        <p className="p-2 text-ash">Carregando...</p>
      ) : top.length === 0 ? (
        <p className="p-2 text-ash">
          Ninguém jogou ainda. A primeira partida abre a tabela.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {top.map((entry) => (
            <li key={entry.userId}>
              <PlayerRow
                riotId={entry.riotId}
                iconId={entry.iconId}
                ring={zones[entry.zone].ring}
                highlight={entry.userId === user?.id}
                badges={
                  <span className={`text-xs ${zones[entry.zone].text}`}>
                    {zones[entry.zone].label}
                  </span>
                }
                leading={
                  <span
                    className={`w-6 text-center font-cond text-xl font-bold tabular-nums ${zones[entry.zone].text}`}
                  >
                    {entry.position}
                  </span>
                }
                right={
                  <span className="flex items-baseline gap-1">
                    <span className="font-cond text-lg font-bold tabular-nums text-gold-50">
                      {entry.points}
                    </span>
                    <span className="text-xs text-ash">pts</span>
                  </span>
                }
              />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export default function Home() {
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  // Buscada uma vez e usada pelos dois cards.
  const ranking = useApi<RankingResponse>("/ranking").data?.ranking;

  return (
    <div className="space-y-6">
      {notice && <Notice tone="warning">{notice}</Notice>}

      <PageHero
        splash={pageSplash.home}
        focus="object-[70%_20%]"
        title={`Da queue gorbila!`}
        subtitle="Personalizada 5x5. A partida começa quando 10 jogadores estiverem prontos."
      >
        <div className="mt-4 max-w-2xl">
          <QueuePanel />
        </div>
      </PageHero>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <MyRecord ranking={ranking} />
        <TopRanking ranking={ranking} />
      </div>

      <Panel title="Como funciona uma partida">
        <ol className="grid gap-4 sm:grid-cols-5">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="relative border-l border-rim pl-4 sm:border-l-0 sm:border-t sm:pl-0 sm:pt-4"
            >
              <span className="font-cond text-sm font-bold text-gold-200">
                {i + 1}
              </span>
              <p className="font-display text-lg text-gold-50">{step.title}</p>
              <p className="mt-1 text-sm text-ash">{step.text}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
