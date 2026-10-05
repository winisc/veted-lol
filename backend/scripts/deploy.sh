#!/usr/bin/env bash
# Atualiza o backend neste servidor (rode no marvin, dentro da pasta backend):
#
#   bash scripts/deploy.sh
#
# O que faz: puxa o código novo do GitHub, reconstrói a imagem do Docker, reinicia o container
# e confere se a API voltou a responder. O banco (volume "data") não é tocado.
#
# Atenção: a fila e os lobbies são gravados no banco e voltam depois do reinício, mas é mais
# educado atualizar quando não tem partida rolando (quem estava jogando fica uns segundos sem resposta).
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-3333}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"

if [ -n "$(git status --porcelain -- .)" ]; then
  echo "Há alterações locais não commitadas nesta pasta. Resolva antes de atualizar:" >&2
  git status --short -- . >&2
  exit 1
fi

echo "==> Puxando o código novo"
git pull --ff-only
VERSION="$(git rev-parse --short HEAD)"

echo "==> Reconstruindo e reiniciando (versão ${VERSION})"
docker compose up -d --build

echo "==> Esperando a API responder em ${HEALTH_URL}"
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Backend no ar na versão ${VERSION}."
    docker image prune -f >/dev/null
    docker compose logs --tail 5 backend
    exit 0
  fi
  sleep 1
done

echo "A API não respondeu em 30 segundos. Últimas linhas do log:" >&2
docker compose logs --tail 40 backend >&2
exit 1
