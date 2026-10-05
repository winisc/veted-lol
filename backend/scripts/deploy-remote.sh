#!/usr/bin/env bash
# Envia o backend do seu PC para o servidor (marvin) e atualiza o container.
# Rode no PC, no Git Bash, a partir da pasta backend:
#
#   npm run deploy:server        (ou: bash scripts/deploy-remote.sh)
#
# O que faz: confere os tipos (tsc), manda o código por ssh (sem precisar de commit nem de GitHub),
# reconstrói a imagem, reinicia o container e confere se a API respondeu.
# Não toca em: .env do servidor, docker-compose.override.yml do servidor e o banco (volume "data").
#
# Variáveis opcionais: SERVER (padrão "servidor"), REMOTE_DIR, HEALTH_PORT, SKIP_TYPECHECK=1
set -euo pipefail

cd "$(dirname "$0")/.."

SERVER="${SERVER:-servidor}"
REMOTE_DIR="${REMOTE_DIR:-/srv/apps/tabela-veted-backend}"
HEALTH_PORT="${HEALTH_PORT:-8000}" # porta publicada no servidor (docker-compose.override.yml)
STAGE="${REMOTE_DIR}/.deploy-stage"

if [ "${SKIP_TYPECHECK:-0}" != "1" ]; then
  echo "==> Conferindo os tipos"
  npx tsc --noEmit
fi

echo "==> Enviando o código para ${SERVER}:${REMOTE_DIR}"
# Só o que o build precisa. Ficam de fora: .env, bancos, node_modules, dist, backups, scripts e o override.
tar -czf - package.json package-lock.json tsconfig.json Dockerfile docker-compose.yml .dockerignore src \
  | ssh "$SERVER" "set -e
      rm -rf '$STAGE' && mkdir -p '$STAGE'
      tar -xzf - -C '$STAGE'
      cd '$STAGE'
      # troca o src inteiro, para arquivos apagados aqui também sumirem lá
      rm -rf '$REMOTE_DIR/src' && mv src '$REMOTE_DIR/src'
      mv -f package.json package-lock.json tsconfig.json Dockerfile docker-compose.yml .dockerignore '$REMOTE_DIR/'
      cd .. && rm -rf '$STAGE'"

echo "==> Reconstruindo e reiniciando no servidor"
ssh "$SERVER" "cd '$REMOTE_DIR' && docker compose up -d --build"

echo "==> Esperando a API responder"
if ssh "$SERVER" "for _ in \$(seq 1 30); do curl -fsS http://127.0.0.1:${HEALTH_PORT}/api/health >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1"; then
  ssh "$SERVER" "docker image prune -f >/dev/null; cd '$REMOTE_DIR' && docker compose logs --tail 5 backend"
  echo "Backend no ar."
else
  echo "A API não respondeu em 30 segundos. Últimas linhas do log:" >&2
  ssh "$SERVER" "cd '$REMOTE_DIR' && docker compose logs --tail 40 backend" >&2
  exit 1
fi
