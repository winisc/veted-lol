import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../errors/AppError'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) })
    return
  }

  console.error(err)
  res.status(500).json({ error: 'Erro interno do servidor.' })
}
