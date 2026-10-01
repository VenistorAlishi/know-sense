---
name: smysl-knowledge-base
description: >-
  Domain workflows for Смысл (know-sense): store v4, Telegram ingest (JSON/ZIP/media),
  MemPalace, Jarvis UI, WSL launchers. Use when changing ingest, knowledge model,
  attachments, chat, map, desktop shortcut, or palace bridge.
---

# Смысл — knowledge base skill

Personal second-brain: Next.js app + MemPalace sidecar + optional Tauri shell.

## Stack ports

| Service | URL |
|---|---|
| Next / Jarvis | `http://127.0.0.1:3847` (`/jarvis`) |
| Palace bridge | `http://127.0.0.1:3851` |
| Ollama (optional) | `http://127.0.0.1:11434` |

Start: `npm run jarvis` or `npm run dev:all`. Windows: WSL + `launchers/start-smysl-wsl.bat`.

## Knowledge model (v4)

Core types in `src/lib/types.ts`:

- **Person** — self (`Кирилл`) / close / other
- **Source** — `telegram_chat` | meeting | note | file | other
- **Chunk** — includes `media_ref` | `transcript` | `ocr` | `caption`
- **Attachment** — TG media kinds; `deriveStatus`: none|pending|done|failed
- **Fact** — status open|done|stale|dismissed; origin heuristic|manual|llm|import
- **Relation** — person↔person edges

Store file: `data/store/knowledge.json`. Migrate via `migrateStoreToV4` in `src/lib/bootstrap.ts`.

Media files: `data/sources/<sourceId>/media/…` (copied from ChatExport on ingest).

## Ingest

| Input | How |
|---|---|
| ChatExport folder | `npm run ingest -- --type telegram /path/ChatExport_*` |
| ZIP of one/many ChatExport_* | `npm run ingest -- chats.zip` or UI `/ingest` |
| result.json only | UI upload or CLI; media stays metadata-only without exportDir |

Key files:

- `src/lib/ingest/telegram.ts` — parse messages + media → Attachment + media_ref chunks
- `src/lib/ingest/unzip-export.ts` — zip → temp → result.json paths
- `src/app/api/ingest/route.ts` — multipart/JSON/zip
- `src/app/api/attachments/route.ts` — list attachments
- `scripts/ingest.mjs` — CLI

Do **not** skip non-text TG messages. Prefer `deriveStatus: pending` over inventing ASR/OCR in this slice unless asked.

## Palace / embeddings

- Bridge: `services/palace/` (FastAPI + MemPalace)
- Embedder: `embeddinggemma` via `npm run setup:embed` / `scripts/ensure-embeddinggemma.sh`
- Broken venv on `/mnt/c`: `npm run repair:wsl` or copy repo to `~/know-sense`

## UI surfaces

- `/jarvis` — command deck + memory map (primary app surface)
- `/ingest`, `/chat`, `/open`, `/settings`, `/extract`
- Desktop: `desktop/` Tauri 2 shell → jarvis URL

## When changing the model

1. Update `src/lib/types.ts` + migrator
2. Update telegram ingest / commitIngest
3. Extend API response fields used by UI
4. Add/adjust fixture under `data/fixtures/tg-media`
5. Verify with `npm run ingest -- data/fixtures/tg-media` (server must be up)

## Out of scope unless requested

- Whisper ASR / OCR pipelines (slots exist on Attachment)
- Replacing Tauri with Electron
- Auth / multi-user
