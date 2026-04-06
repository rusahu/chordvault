# Stage 1: Build frontend
FROM node:25-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json frontend/.npmrc ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend native deps
FROM node:25-alpine AS backend
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --production

# Stage 3: Final
FROM node:25-alpine
RUN addgroup -g 1001 appuser && adduser -D -u 1001 -G appuser appuser
WORKDIR /app
COPY --from=backend /app/node_modules ./node_modules
COPY server.js ./
COPY lib/ ./lib/
COPY routes/ ./routes/
COPY --from=frontend /app/public ./public
COPY public/locales ./public/locales
COPY scripts/seed-data.mjs ./scripts/seed-data.mjs
COPY entrypoint.sh ./
RUN mkdir -p data && chown appuser:appuser data
USER appuser
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3100/api/auth/config || exit 1
CMD ["sh", "entrypoint.sh"]
