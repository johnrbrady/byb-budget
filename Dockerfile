# ── Stage 1: Build the frontend ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Production image ───────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Only install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server + built frontend
COPY server.js ./
COPY --from=build /app/dist ./dist

# Data volume — mount a TrueNAS dataset here for persistence
VOLUME /data
ENV BYB_DATA_DIR=/data
ENV BYB_PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
