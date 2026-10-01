FROM node:22-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# O banco SQLite fica num volume, fora da imagem
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production
ENV DB_PATH=/data/data.db
EXPOSE 3333

USER node

CMD ["node", "dist/server.js"]
