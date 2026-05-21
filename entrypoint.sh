#!/bin/sh
set -e

DATA_DIR="/app/data"
mkdir -p "$DATA_DIR"

# ── Detect the UID/GID that owns the data directory ──────────────────────
# When users bind-mount a host folder (e.g. ./data:/app/data), the mounted
# directory retains the host's ownership.  We must run Node as THAT user so
# SQLite can open / create its database file without SQLITE_CANTOPEN errors.
#
# `stat -c` is BusyBox/GNU syntax (works on Alpine).
DATA_UID=$(stat -c '%u' "$DATA_DIR")
DATA_GID=$(stat -c '%g' "$DATA_DIR")

echo "ChordVault: data dir owned by UID=$DATA_UID GID=$DATA_GID"

# ── Seed demo data (if requested) ───────────────────────────────────────
if [ "$DEMO_MODE" = "true" ] && [ ! -f "$DATA_DIR/chordvault.db" ]; then
  echo "Demo mode: seeding database..."
  node scripts/seed-data.mjs
  echo "Demo mode: seeding complete"
fi

# ── Drop privileges and exec Node ───────────────────────────────────────
# If we are already running as the correct UID, just exec directly.
# Otherwise use su-exec (Alpine's lightweight alternative to gosu) to
# switch to the owner of the data directory.
if [ "$(id -u)" = "$DATA_UID" ]; then
  exec node server.js
else
  # Ensure the app files are readable by the target user
  chown -R "$DATA_UID:$DATA_GID" /app
  exec su-exec "$DATA_UID:$DATA_GID" node server.js
fi
