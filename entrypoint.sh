#!/bin/sh
# Ensure data directory exists (Docker may create the bind-mount as root-owned)
mkdir -p /app/data
if [ "$DEMO_MODE" = "true" ] && [ ! -f /app/data/chordvault.db ]; then
  echo "Demo mode: seeding database..."
  node scripts/seed-data.mjs
  echo "Demo mode: seeding complete"
fi
exec node server.js
