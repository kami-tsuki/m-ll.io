# ---- Build Stage ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install build dependencies (better-sqlite3 native build requirements handled automatically on debian slim)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget git && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json tailwind.config.cjs postcss.config.cjs ./
COPY src ./src
COPY public ./public

RUN npm run build

# ---- Runtime Stage ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

RUN mkdir -p data

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "run", "start:prod"]
