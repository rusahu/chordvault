# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend native deps
FROM node:20-alpine AS backend
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --production

# Stage 3: Final
FROM node:20-alpine
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
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100',r=>{if(r.statusCode!==200)throw r.statusCode})"
CMD ["sh", "entrypoint.sh"]
