const TOKEN_KEY = 'token'
export const BANNED_EVENT = 'veted:banned'

// Endereço da API. Em desenvolvimento fica vazio e o Vite repassa /api para o backend local.
// Em produção (ex.: Cloudflare Pages) defina VITE_API_URL no build com a URL pública do backend.
export const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  code?: string // código do servidor para casos que o app trata (ex.: 'ROLES_REQUIRED')

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Envia um arquivo cru no corpo (ex.: o print do placar), com o mesmo tratamento de erro do `api`.
export async function apiUpload<T>(path: string, file: Blob): Promise<T> {
  const token = tokenStorage.get()
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: file,
    })
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (data.code === 'BANNED' && token) window.dispatchEvent(new CustomEvent(BANNED_EVENT))
    throw new ApiError(data.error ?? (res.status === 413 ? 'Imagem grande demais (até 10 MB).' : 'Erro inesperado.'), res.status, data.code)
  }
  return data as T
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenStorage.get()

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor.', 0)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Banido com a sessão aberta: o app desloga e mostra o aviso na tela de entrar.
    if (data.code === 'BANNED' && token) window.dispatchEvent(new CustomEvent(BANNED_EVENT))
    throw new ApiError(data.error ?? 'Erro inesperado.', res.status, data.code)
  }
  return data as T
}
