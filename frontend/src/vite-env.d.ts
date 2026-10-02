/// <reference types="vite/client" />

interface ImportMetaEnv {
  // URL pública do backend em produção (ex.: https://api.meusite.com). Vazio em desenvolvimento.
  readonly VITE_API_URL?: string
}
