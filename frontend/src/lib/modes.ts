// Modos de fila (mesmos valores do backend).
export type QueueMode = "vote" | "ranked" | "aram3" | "aram4" | "aram5";

export const queueModes: Record<
  QueueMode,
  { name: string; short: string; description: string }
> = {
  vote: {
    name: "Modo capitão",
    short: "Capitão",
    description: "Os 10 votam e os 2 mais votados viram capitães.",
  },
  ranked: {
    name: "Modo tabela",
    short: "Tabela",
    description:
      "Os 2 mais bem colocados na tabela entre os 10 viram capitães.",
  },
  aram3: { name: "ARAM 3x3", short: "ARAM 3x3", description: "6 jogadores, times sorteados." },
  aram4: { name: "ARAM 4x4", short: "ARAM 4x4", description: "8 jogadores, times sorteados." },
  aram5: { name: "ARAM 5x5", short: "ARAM 5x5", description: "10 jogadores, times sorteados." },
};

// Filas 5x5 com capitães e draft (tabela normal).
export const queueModeOrder: QueueMode[] = ["vote", "ranked"];

// Filas de ARAM: sem capitães nem draft; os times são sorteados equilibrando pela tabela de ARAM.
export const aramModes: QueueMode[] = ["aram3", "aram4", "aram5"];

export const isAramMode = (mode: QueueMode | null | undefined) =>
  mode === "aram3" || mode === "aram4" || mode === "aram5";

// Tabelas de pontos: a normal (filas 5x5) e a de ARAM (3x3, 4x4 e 5x5 juntos).
export type Board = "normal" | "aram";
