#!/usr/bin/env bash
# Ingest first Telegram ChatExport from Windows Music folder (WSL path).
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EXPORT="${1:-/mnt/c/Users/KIRILL/Music/ChatExport_2026-09-28}"
JARVIS="http://127.0.0.1:3847/"

if [[ ! -e "$EXPORT" ]]; then
  echo "ERROR: export not found: $EXPORT"
  echo "Pass the folder or result.json path:"
  echo "  bash scripts/ingest-first-chat.sh /mnt/c/Users/KIRILL/Music/ChatExport_XXXX"
  exit 1
fi

if ! curl -sf --max-time 2 "$JARVIS" >/dev/null 2>&1; then
  echo "ERROR: Смысл not running at $JARVIS"
  echo "Start first: npm run jarvis   (leave that window open)"
  exit 1
fi

echo "==> Ingesting Telegram export: $EXPORT"
npm run ingest -- --type telegram "$EXPORT"
echo "OK. Open http://127.0.0.1:3847/jarvis"
