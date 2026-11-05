#!/bin/bash
# Double-click this file to set up (first run) and start Techmaax EMS.
# Safe to run again any time — it skips steps that are already done.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

pause_and_exit() {
  echo
  read -r -p "Press Enter to close this window..."
  exit "${1:-0}"
}
trap 'pause_and_exit 1' ERR

echo "== Techmaax EMS =="
echo

if [ ! -f server/.env ]; then
  echo "No server/.env found — creating one from server/.env.example"
  cp server/.env.example server/.env
  echo
  echo "IMPORTANT: open server/.env and set a real DATABASE_URL and JWT secrets,"
  echo "then double-click this file again to continue."
  command -v open >/dev/null 2>&1 && open -e server/.env
  pause_and_exit 0
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only, this can take a minute)..."
  npm install
fi

echo "Generating Prisma client..."
(cd server && npx prisma generate)

if [ -d server/prisma/migrations ] && [ -n "$(ls -A server/prisma/migrations 2>/dev/null)" ]; then
  echo "Applying database migrations..."
  (cd server && npx prisma migrate deploy)
else
  echo "Creating and applying the initial database migration..."
  (cd server && npx prisma migrate dev --name init)
fi

echo "Seeding the database (safe to re-run — it upserts, no duplicates)..."
(cd server && npx tsx prisma/seed.ts)

echo
echo "Starting the API (port 4000) and web app (port 5173)..."
echo "Press Ctrl+C in this window to stop both."
echo

trap - ERR
npm run dev
pause_and_exit 0
