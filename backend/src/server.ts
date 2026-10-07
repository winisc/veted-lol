import 'dotenv/config'
import app from './app'
import { startBackups } from './database/backup'
import { flushAll } from './database/runtimeState'
import { startSeasonScheduler } from './modules/seasons/season.service'
import { lobbyService } from './modules/lobby/lobby.service'
import { queueService } from './modules/queue/queue.service'

const PORT = Number(process.env.PORT) || 3333

if (!process.env.RIOT_API_KEY) {
  console.warn('RIOT_API_KEY não definida: a validação de Riot ID está desativada.')
}

// Garante a season atual (e arquiva a tabela antiga na primeira vez) antes de qualquer coisa.
startSeasonScheduler()

// Recupera a fila, as confirmações e os lobbies que estavam de pé antes do último desligamento.
const restoredLobbies = lobbyService.restore()
const restoredQueue = queueService.restore()
if (restoredLobbies > 0 || restoredQueue > 0) {
  console.log(`Estado recuperado: ${restoredLobbies} lobby(s), ${restoredQueue} jogador(es) na fila/confirmação.`)
}

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`)
})

startBackups()

// Ao desligar de forma normal (docker stop, Ctrl+C), grava o estado na hora.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    flushAll()
    process.exit(0)
  })
}
