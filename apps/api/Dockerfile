# ─── Pulse API — multi-stage build for Cloud Run ─────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# Cloud Run provides PORT; default to 4000 locally.
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/main.js"]
