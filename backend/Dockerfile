FROM node:22-slim AS build

# better-sqlite3 é nativo e precisa compilar
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim

WORKDIR /app

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# O banco SQLite fica num volume, fora da imagem
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production
ENV DB_PATH=/data/data.db
EXPOSE 3333

USER node

CMD ["node", "dist/server.js"]
