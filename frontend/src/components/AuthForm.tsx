import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useRiotLookup } from "../hooks/useRiotLookup";
import { pageSplash } from "../lib/ddragon";
import { cleanRiotIdInput, normalizeRiotId } from "../lib/riotId";
import RiotIdPreview from "./RiotIdPreview";
import HexButton from "./ui/HexButton";
import { BrandMark } from "./ui/icons";
import Notice from "./ui/Notice";

interface AuthFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  footerText: string;
  footerLinkLabel: string;
  footerLinkTo: string;
  confirmPassword?: boolean;
  validateRiotId?: boolean;
  onSubmit: (riotId: string, password: string) => Promise<void>;
}

const inputClass =
  "mt-1.5 h-11 w-full rounded-md border border-rim bg-abyss px-3 text-gold-50 placeholder-ash-dim outline-none transition-colors focus:border-gold-200";

export default function AuthForm({
  title,
  subtitle,
  submitLabel,
  footerText,
  footerLinkLabel,
  footerLinkTo,
  confirmPassword,
  validateRiotId,
  onSubmit,
}: AuthFormProps) {
  const [riotId, setRiotId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lookup = useRiotLookup(riotId, Boolean(validateRiotId));
  const blocked = lookup.status === "loading" || lookup.status === "notfound";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (confirmPassword && password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(normalizeRiotId(riotId), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Splash art à esquerda (no celular, vira fundo apagado). */}
      <div className="relative isolate overflow-hidden lg:min-h-screen">
        <img
          src={pageSplash.auth}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[72%_25%] opacity-40 lg:opacity-90"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-void via-void/60 to-void/10 lg:bg-linear-to-r lg:from-void/10 lg:via-void/30 lg:to-void"
        />
        <div className="flex h-full flex-col justify-between gap-10 p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-[43px]" />
            <span className="font-display text-2xl text-gold-50"><span className="sr-only">x5 </span>Veted</span>
          </div>
          <div className="hidden max-w-md lg:block">
            <p className="font-display text-4xl leading-tight text-gold-50">
              Quem vai dormir de couro quente?
            </p>
            <p className="mt-4 text-gold-50/70">
              Fila de 10 jogadores, votação de capitães, draft 1-2-2-2-1,
              votação de MVP e de bagre, e tabela com pontos.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-center px-4 pb-12 lg:items-center lg:bg-void/80 lg:py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl text-gold-50">{title}</h1>
          <p className="mt-1 text-ash">{subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block text-sm font-medium text-gold-50">
              Riot ID
              <input
                className={inputClass}
                value={riotId}
                onChange={(e) => setRiotId(cleanRiotIdInput(e.target.value))}
                placeholder="Nome#BR1"
                autoComplete="username"
                required
              />
            </label>

            {validateRiotId && <RiotIdPreview lookup={lookup} />}

            <label className="block text-sm font-medium text-gold-50">
              Senha
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  confirmPassword ? "new-password" : "current-password"
                }
                required
              />
            </label>

            {confirmPassword && (
              <label className="block text-sm font-medium text-gold-50">
                Confirmar senha
                <input
                  className={inputClass}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
            )}

            {error && <Notice>{error}</Notice>}

            <HexButton
              type="submit"
              size="lg"
              disabled={submitting || blocked}
              className="w-full"
            >
              {submitting ? "Aguarde..." : submitLabel}
            </HexButton>
          </form>

          <p className="mt-6 text-center text-sm text-ash">
            {footerText}{" "}
            <Link
              to={footerLinkTo}
              className="font-semibold text-gold-200 hover:text-gold-50"
            >
              {footerLinkLabel}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
