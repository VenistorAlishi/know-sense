#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.cargo/bin:/usr/local/cargo/bin:${PATH}"
cd "$ROOT/desktop"
if [[ ! -d node_modules ]]; then
  npm install
fi
# Prefer rustup toolchain when present
if command -v rustup >/dev/null 2>&1; then
  rustup default stable >/dev/null 2>&1 || true
fi
exec npm run dev
