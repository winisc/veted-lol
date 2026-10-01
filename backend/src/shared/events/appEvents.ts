import { EventEmitter } from 'node:events'

// Barramento simples entre módulos, para um módulo avisar outro sem importá-lo (evita dependência circular).
//   'lobby:left' (userIds: number[]) -> jogadores que deixaram o lobby (saíram ou ele foi cancelado)
export const appEvents = new EventEmitter()
