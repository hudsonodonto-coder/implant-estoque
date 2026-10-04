# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/

RUN npm ci
RUN npm --prefix client ci

COPY . .
RUN npm --prefix client run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY data/seed.json ./data/seed.json
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /data

EXPOSE 8080
CMD ["node", "server/index.js"]
