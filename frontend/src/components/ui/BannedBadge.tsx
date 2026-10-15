// Selo de conta banida (fica na tabela, mas marcada).
export default function BannedBadge() {
  return (
    <span
      title="Conta banida"
      className="shrink-0 rounded bg-team-red/15 px-1.5 py-0.5 font-sans text-[11px] font-bold uppercase tracking-wide text-team-red no-underline"
    >
      Banido
    </span>
  )
}
