#!/bin/sh
set -e

echo "Initializing directories..."
mkdir -p /data/media

echo "Starting Go API backend server on :8421..."
DB_PATH=/data/app.db MEDIA_DIR=/data/media PORT=8421 /app/server &
BACKEND_PID=$!

# Trap signals and forward to child processes
trap 'kill -TERM $BACKEND_PID; exit 0' SIGTERM SIGINT

# Give backend a moment to initialize database
sleep 1

echo "Starting Nginx frontend server..."
exec nginx -g "daemon off;"
