# Stage 1: Build TypeScript
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY etc/ ./etc/
COPY src/ ./src/
RUN npm run build

# Stage 2: Production runtime
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dst ./dst
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
ENV DATA_DIR=/data
CMD ["node", "dst/mcp-funnel.js"]
