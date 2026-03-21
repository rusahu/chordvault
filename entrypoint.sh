#!/bin/sh
if [ "$DEMO_MODE" = "true" ] && [ ! -f /app/data/chordvault.db ]; then
  echo "Demo mode: seeding database..."
  node scripts/seed-data.mjs
  echo "Demo mode: seeding complete"
fi
exec node server.js
