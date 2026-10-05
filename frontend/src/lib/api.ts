const TOKEN_KEY = 'token'

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
  if (!res.ok) throw new ApiError(data.error ?? 'Erro inesperado.', res.status, data.code)
  return data as T
}
