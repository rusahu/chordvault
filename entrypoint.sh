#!/bin/sh
node server.js &
SERVER_PID=$!
if [ "$DEMO_MODE" = "true" ] && [ ! -f /app/data/chordvault.db ]; then
  echo "Demo mode: waiting for server to start..."
  sleep 3
  node scripts/seed-data.mjs http://localhost:3100
  echo "Demo mode: seeding complete"
fi
wait $SERVER_PID
