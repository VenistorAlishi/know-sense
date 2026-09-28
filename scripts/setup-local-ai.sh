#!/usr/bin/env bash
# Install / verify local AI for Смысл: Ollama + Qwen3.5 9B (+ optional embed check).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODEL="${OLLAMA_MODEL:-${LLM_MODEL:-qwen3.5:9b}}"
OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"

echo "==> Смысл local AI setup"
echo "    model: $MODEL"

if ! command -v zstd >/dev/null 2>&1; then
  echo "==> Installing zstd (needed by Ollama installer)..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y -qq zstd
  fi
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "==> Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
fi

# Start daemon if needed
if ! curl -sf "$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
  echo "==> Starting ollama serve..."
  if command -v systemctl >/dev/null 2>&1 && systemctl is-enabled ollama >/dev/null 2>&1; then
    sudo systemctl start ollama || true
  fi
  if ! curl -sf "$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
    nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
    for i in $(seq 1 40); do
      if curl -sf "$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
        break
      fi
      sleep 0.5
    done
  fi
fi

if ! curl -sf "$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
  echo "ERROR: Ollama API not reachable at $OLLAMA_HOST" >&2
  echo "  Check /tmp/ollama-serve.log or run: ollama serve" >&2
  exit 1
fi

echo "==> Pulling $MODEL (may take a while)..."
ollama pull "$MODEL"

echo "==> Verifying chat completions..."
curl -sf "$OLLAMA_HOST/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ollama" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Ответь одним словом: ок\"}],\"max_tokens\":16}" \
  | head -c 400
echo
echo
echo "OK. Chat will auto-detect Ollama."
echo "  npm run palace   # MemPalace + embeddinggemma"
echo "  npm run dev      # Next on :3847"
echo "  or: npm run setup:ai && npm run dev:all"
