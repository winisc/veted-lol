import 'dotenv/config'
import app from './app'

const PORT = Number(process.env.PORT) || 3333

if (!process.env.RIOT_API_KEY) {
  console.warn('RIOT_API_KEY não definida: a validação de Riot ID está desativada.')
}

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`)
})
