# Stage 1: Build React SPA Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Build Pure-Go Backend Binary
FROM golang:alpine AS backend-builder
WORKDIR /app/backend

COPY backend/go.* ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server ./cmd/server

# Stage 3: Production Runtime (Nginx + Go binary in single container)
FROM nginx:alpine
WORKDIR /app

# Install ca-certificates and curl/tzdata if needed
RUN apk add --no-cache ca-certificates tzdata

# Copy built frontend assets to Nginx web root
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy Go backend binary
COPY --from=backend-builder /app/server /app/server

# Copy Nginx server configuration
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Persisted data volume for SQLite database and media uploads
VOLUME ["/data"]

# Only expose Nginx's HTTP port
EXPOSE 80

ENTRYPOINT ["/app/entrypoint.sh"]
