// Modos de fila (mesmos valores do backend).
export type QueueMode = "vote" | "ranked";

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
};

export const queueModeOrder: QueueMode[] = ["vote", "ranked"];
