#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash services/palace/run.sh &
PALACE_PID=$!

cleanup() {
  kill "$PALACE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# wait for palace health
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3851/health >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

npm run dev
