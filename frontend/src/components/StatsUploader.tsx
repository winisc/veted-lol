import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PlayerGameStats, Side, StatsDraft } from '../hooks/useLobby'
import { apiUpload } from '../lib/api'
import { useChampions } from '../lib/champions'
import { sideStyle, splitRiotId } from '../lib/teams'
import ConfirmDialog from './ui/ConfirmDialog'
import HexButton from './ui/HexButton'
import Notice from './ui/Notice'

export interface StatsPlayer {
  id: number
  riotId: string
  side: Side
}

interface Props {
  players: StatsPlayer[] // na ordem em que aparecem em cada time
  uploadPath: string // rota que lê o print (devolve o rascunho para conferir)
  intro?: ReactNode // texto acima do envio
  submitLabel: string
  busy: boolean
  onSubmit: (rows: PlayerGameStats[]) => void
  onSkip?: () => void // sem isso, não tem o botão "Pular"
  onCancel?: () => void // sem isso, não tem o botão "Cancelar"
}

// Linha da conferência: tudo como texto, para os campos poderem ficar vazios enquanto se digita.
interface Row {
  userId: number
  champion: string // id do campeão ('' = não escolhido)
  championText: string // o que está no campo (nome em português)
  kills: string
  deaths: string
  assists: string
}

const NUMBER_FIELDS = ['kills', 'deaths', 'assists'] as const

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()

const cell = 'h-8 w-full rounded border border-rim bg-void px-1.5 text-center font-cond text-base tabular-nums text-gold-50 outline-none focus:border-gold-200'

// Envio do print da pancada e conferência do campeão e do KDA de cada jogador (no lobby, pelo capitão vencedor;
// no admin, em partidas já salvas). Lê o print no servidor, mostra o que foi lido e deixa corrigir antes de salvar.
export default function StatsUploader({ players, uploadPath, intro, submitLabel, busy, onSubmit, onSkip, onCancel }: Props) {
  const { champions, nameOf, iconOf, ready } = useChampions()
  const [image, setImage] = useState<string | null>(null) // prévia do print enviado
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<StatsDraft | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const byName = useMemo(() => new Map(champions.map((c) => [normalize(c.name), c.id])), [champions])

  const send = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Envie uma imagem (PNG ou JPG).')
        return
      }
      setError('')
      setReading(true)
      setImage((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(file)
      })
      try {
        const { draft: d } = await apiUpload<{ draft: StatsDraft }>(uploadPath, file)
        setDraft(d)
        setRows(
          players.map((p) => {
            const r = d.rows.find((x) => x.userId === p.id)
            const text = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
            return {
              userId: p.id,
              champion: r?.champion ?? '',
              championText: r?.champion ? nameOf(r.champion) : '',
              kills: text(r?.kills),
              deaths: text(r?.deaths),
              assists: text(r?.assists),
            }
          }),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível ler o print.')
      } finally {
        setReading(false)
      }
    },
    [players, nameOf, uploadPath],
  )

  // Colar o print direto (Ctrl+V), sem precisar salvar o arquivo.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (file) send(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [send])

  // Quando os nomes dos campeões chegam depois do rascunho, preenche o nome dos que vieram lidos.
  useEffect(() => {
    if (!ready) return
    setRows((list) => list.map((r) => (r.champion && !r.championText ? { ...r, championText: nameOf(r.champion) } : r)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const update = (userId: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.userId === userId ? { ...r, ...patch } : r)))

  const missing = (r: Row) => !r.champion || NUMBER_FIELDS.some((f) => r[f] === '')
  const duplicated = new Set(rows.map((r) => r.champion).filter((c, i, all) => c && all.indexOf(c) !== i))
  const incomplete = rows.some(missing)

  function confirm() {
    if (incomplete || duplicated.size > 0) {
      setShowErrors(true)
      return
    }
    onSubmit(
      rows.map((r) => ({
        userId: r.userId,
        champion: r.champion,
        kills: Number(r.kills),
        deaths: Number(r.deaths),
        assists: Number(r.assists),
        cs: null,
        gold: null,
        damage: null,
      })),
    )
  }

  return (
    <div className="space-y-5">
      {intro}

      {!draft && (
        <ol className="mx-auto max-w-xl list-decimal space-y-0.5 pl-5 text-sm text-ash">
          <li>
            No cliente, na tela de fim de partida, abra a aba <b className="text-gold-50">Placar</b> (se já fechou, serve o
            detalhe da partida no histórico, também na aba Placar).
          </li>
          <li>
            Com a janela do cliente selecionada, aperte <b className="text-gold-50">Alt + Print Screen</b> (copia só a janela).
          </li>
          <li>
            Volte aqui e cole com <b className="text-gold-50">Ctrl + V</b> (ou escolha o arquivo do print).
          </li>
        </ol>
      )}

      {!draft ? (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) send(file)
          }}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-rim bg-void/50 px-4 py-10 text-center transition-colors hover:border-gold-200/60"
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={reading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) send(file)
              e.target.value = ''
            }}
          />
          {reading ? (
            <span className="flex items-center gap-2 text-gold-50">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-rim border-t-gold-200" aria-hidden="true" />
              Lendo o print...
            </span>
          ) : (
            <>
              <span className="font-display text-lg text-gold-50">Clique para escolher o print</span>
              <span className="text-sm text-ash">ou arraste a imagem aqui, ou cole com Ctrl+V</span>
            </>
          )}
        </label>
      ) : (
        <>
          {draft.note && <Notice tone="warning">{draft.note}</Notice>}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="space-y-3 overflow-x-auto">
              {(['blue', 'red'] as Side[]).map((side) => (
                <TeamTable
                  key={side}
                  side={side}
                  members={players.filter((p) => p.side === side)}
                  rows={rows}
                  showErrors={showErrors}
                  duplicated={duplicated}
                  iconOf={iconOf}
                  onChange={update}
                  onChampionText={(userId, text) => update(userId, { championText: text, champion: byName.get(normalize(text)) ?? '' })}
                />
              ))}
              <datalist id="champions">
                {champions.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            {image && (
              <a href={image} target="_blank" rel="noreferrer" className="block self-start" title="Abrir o print">
                <img src={image} alt="Print enviado" className="w-full rounded-lg border border-rim" />
                <span className="mt-1 block text-center text-xs text-ash">Print enviado (clique para ampliar)</span>
              </a>
            )}
          </div>
        </>
      )}

      {error && <Notice>{error}</Notice>}
      {showErrors && (incomplete || duplicated.size > 0) && (
        <Notice>
          {duplicated.size > 0
            ? 'Tem campeão repetido: cada jogador joga com um campeão diferente.'
            : 'Preencha o campeão e o KDA (abates, mortes e assistências) de todos os jogadores.'}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {draft && (
          <HexButton onClick={confirm} disabled={busy}>
            {submitLabel}
          </HexButton>
        )}
        {draft && (
          <label className="cursor-pointer text-sm font-semibold text-ash transition-colors hover:text-gold-50">
            Trocar o print
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) send(file)
                e.target.value = ''
              }}
            />
          </label>
        )}
        <span className="ml-auto flex gap-2">
          {onCancel && (
            <HexButton variant="secondary" onClick={onCancel} disabled={busy}>
              Cancelar
            </HexButton>
          )}
          {onSkip && (
            <HexButton variant="secondary" onClick={() => setConfirmSkip(true)} disabled={busy || reading}>
              Pular
            </HexButton>
          )}
        </span>
      </div>

      <ConfirmDialog
        open={confirmSkip}
        title="Pular o print da pancada?"
        confirmLabel="Pular"
        cancelLabel="Voltar"
        busy={busy}
        onConfirm={() => {
          setConfirmSkip(false)
          onSkip?.()
        }}
        onCancel={() => setConfirmSkip(false)}
      >
        <p className="text-sm text-ash">
          A partida fica sem o campeão e o KDA de cada um, que não entram nas estatísticas de ninguém.
        </p>
      </ConfirmDialog>
    </div>
  )
}

function TeamTable({
  side,
  members,
  rows,
  showErrors,
  duplicated,
  iconOf,
  onChange,
  onChampionText,
}: {
  side: Side
  members: StatsPlayer[]
  rows: Row[]
  showErrors: boolean
  duplicated: Set<string>
  iconOf: (id: string) => string
  onChange: (userId: number, patch: Partial<Row>) => void
  onChampionText: (userId: number, text: string) => void
}) {
  const style = sideStyle[side]
  return (
    <table className="w-full min-w-[28rem] border-separate border-spacing-y-1 text-sm">
      <thead>
        <tr className="text-left text-xs text-ash">
          <th className={`pb-1 font-display text-sm ${style.text}`}>{style.name}</th>
          <th className="pb-1 font-semibold">Campeão</th>
          <th className="w-12 pb-1 text-center font-semibold">A</th>
          <th className="w-12 pb-1 text-center font-semibold">M</th>
          <th className="w-12 pb-1 text-center font-semibold">As</th>
        </tr>
      </thead>
      <tbody>
        {members.map((m) => {
          const row = rows.find((r) => r.userId === m.id)
          if (!row) return null
          const bad = (value: string, required: boolean) => showErrors && required && value === ''
          const champBad = showErrors && (!row.champion || duplicated.has(row.champion))
          return (
            <tr key={m.id}>
              <td className="max-w-36 truncate pr-2 font-semibold text-gold-50" title={m.riotId}>
                {splitRiotId(m.riotId)[0]}
              </td>
              <td className="pr-2">
                <div className="flex items-center gap-1.5">
                  {row.champion ? (
                    <img src={iconOf(row.champion)} alt="" className="h-8 w-8 shrink-0 rounded" />
                  ) : (
                    <span className="h-8 w-8 shrink-0 rounded border border-dashed border-rim" />
                  )}
                  <input
                    list="champions"
                    value={row.championText}
                    onChange={(e) => onChampionText(m.id, e.target.value)}
                    placeholder="Campeão"
                    aria-label={`Campeão de ${splitRiotId(m.riotId)[0]}`}
                    className={`h-8 w-full min-w-28 rounded border bg-void px-2 text-gold-50 outline-none focus:border-gold-200 ${
                      champBad ? 'border-team-red' : 'border-rim'
                    }`}
                  />
                </div>
              </td>
              {NUMBER_FIELDS.map((f) => (
                <td key={f} className="px-0.5">
                  <input
                    inputMode="numeric"
                    value={row[f]}
                    onChange={(e) => onChange(m.id, { [f]: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                    aria-label={`${f} de ${splitRiotId(m.riotId)[0]}`}
                    className={`${cell} ${bad(row[f], true) ? 'border-team-red' : ''}`}
                  />
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
