import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-troque-em-producao'

export function signToken(userId: number) {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: '7d' })
}

// Retorna o id do usuário ou null se o token for inválido/expirado.
export function verifyToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (typeof payload === 'string' || !payload.sub) return null
    return Number(payload.sub)
  } catch {
    return null
  }
}
