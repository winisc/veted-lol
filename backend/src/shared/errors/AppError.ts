export class AppError extends Error {
  readonly status: number
  readonly code?: string // identifica o erro para o frontend reagir (ex.: 'ROLES_REQUIRED')

  constructor(message: string, status = 400, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}
