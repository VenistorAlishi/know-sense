# Смысл — персональная векторная база знаний

Одна база **про Кирилла**: люди, источники, чанки и факты.  
MemPalace — local-first memory sidecar; чат синтезирует ответ через **Ollama (Qwen3.5 9B)** или работает в extractive-режиме.

## Запуск

```bash
npm install
npm run setup:ai      # один раз: Ollama + qwen3.5:9b
npm run setup:embed   # один раз: EmbeddingGemma ONNX (multilingual/RU)
npm run palace:remine # один раз после смены эмбеддера / пустого palace
npm run dev:all       # Next :3847 + palace :3851 (+ soft-start Ollama)
```

Или раздельно:

```bash
npm run palace   # http://127.0.0.1:3851  (embeddinggemma)
npm run dev      # http://127.0.0.1:3847
```

Откройте [Jarvis](http://127.0.0.1:3847/jarvis) (карта памяти + command bar), [главную](http://127.0.0.1:3847) или [чат](http://127.0.0.1:3847/chat).

### Ярлык запуска

Один клик: поднимет Next+palace (если ещё не запущены) и откроет Jarvis.

**Windows (твой рабочий стол):** из локального клона репо один раз:

```powershell
powershell -ExecutionPolicy Bypass -File .\launchers\install-windows-shortcut.ps1
```

Появится ярлык **«Смысл Jarvis»** на Desktop. Дальше — двойной клик.  
Рекомендуется WSL (полный стек palace+эмбеддер). Подробности: [`launchers/README.md`](launchers/README.md).

**Linux:**

```bash
npm run shortcut   # один раз: .desktop → меню приложений (+ Desktop)
npm run jarvis     # запуск без ярлыка
```

Если собран Tauri (`npm run desktop:build`) — откроется нативное окно; иначе браузер на `/jarvis`.

### Desktop (Tauri 2)

```bash
# зависимости ОС (Ubuntu/Debian): webkit2gtk, build-essential, libssl-dev, …
# Rust: https://rustup.rs
cd desktop && npm install && cd ..
npm run dev:all          # в одном терминале — Next + palace
npm run desktop:dev      # окно «Смысл — Jarvis» → http://127.0.0.1:3847/jarvis
```

Скопируйте [`.env.example`](.env.example) → `.env.local` при необходимости.

### LLM для чата

Приоритет: **env-ключ → [/settings](http://127.0.0.1:3847/settings) → Ollama → extractive**.

Модель Cursor из агента в приложение не подключается (нет публичного API-ключа).  
Вставьте свой ключ OpenAI / Anthropic / OpenRouter на [/settings](http://127.0.0.1:3847/settings) или в `.env.local`.

### Переменные окружения

| Var | Default | Назначение |
|---|---|---|
| `PALACE_URL` | `http://127.0.0.1:3851` | URL FastAPI-bridge MemPalace |
| `MEMPALACE_EMBEDDING_MODEL` | `embeddinggemma` | multilingual/RU эмбеддер (не MiniLM) |
| `MEMPALACE_LANG` | `ru` | язык palace |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` | — | облачный LLM |
| `LLM_MODEL` / `OLLAMA_MODEL` | `qwen3.5:9b` | модель чата |
| `LLM_BASE_URL` | auto | OpenAI-compat / Ollama |

Без ключа и без Ollama чат работает в **extractive** режиме (цитаты из памяти).

## Архитектура

- **Смысл (Next.js)** — Person/Source модель, TG-ingest, UI
- **Palace bridge (`services/palace`)** — FastAPI над MemPalace (`mine` / `search`), эмбеддер **embeddinggemma**
- **Ollama** — локальный LLM для `/api/chat` (auto-detect на `:11434`)
- После ingest чанки синхронизируются в wings (`kirill`, близкие контакты)
- `/api/chat` → palace search (+ local store fallback) → LLM или extractive

## Модель (v3)

- **Person** — Кирилл (`isSelf`) + близкие (`close`) + остальные
- **Source** — `telegram_chat` | `meeting` | `note` | `file` | `other`
- **Chunk** — текстовое окно + локальный эмбеддинг в JSON-store
- **Fact** — смысл с `status` (open/done/stale/dismissed) и `origin` (heuristic/manual/llm/import)
- **Relation** — тонкие связи между людьми
- **MemPalace drawers** — verbatim для recall

Хранилище: `data/store/knowledge.json`, сырьё: `data/sources/`, palace: `data/palace/`.

UI: [/jarvis](http://127.0.0.1:3847/jarvis) — command deck + embedding-карта; Inbox на главной; [/open](http://127.0.0.1:3847/open); чат `state|recall|auto`; [/extract](http://127.0.0.1:3847/extract).

Карта: `GET /api/map` — PCA 384→2D по chunk/fact/person embeddings.

## Telegram → первый корпус

1. Telegram Desktop → Export chat history → **JSON**
2. Загрузите 3 личные переписки через [/ingest](http://127.0.0.1:3847/ingest)
3. Peer станет близким; чанки уйдут в MemPalace wings
4. Спросите в [/chat](http://127.0.0.1:3847/chat): «о чём мы с Анной?»

```bash
npm run ingest -- --type telegram \
  data/fixtures/tg1/result.json \
  data/fixtures/tg2/result.json \
  data/fixtures/tg3/result.json
```

## Смена эмбеддера

После смены `MEMPALACE_EMBEDDING_MODEL` векторное пространство другое — пересоберите индекс:

```bash
npm run palace:remine
npm run palace
```

## API

```bash
curl http://127.0.0.1:3851/health
curl http://127.0.0.1:3847/api/map
curl http://127.0.0.1:3847/api/chat
curl -X POST http://127.0.0.1:3847/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"какие задачи по бюджету?"}'
```

## Структура кода

- `src/lib/types.ts` / `bootstrap.ts` / `store.ts` — персональная БД
- `src/lib/map-project.ts` + `api/map` — PCA-карта памяти
- `src/lib/llm.ts` — auto-detect Ollama / OpenAI-compat
- `src/lib/ingest/` — ingest + `palace-sync.ts`
- `src/lib/palace.ts` — клиент sidecar
- `services/palace/` — MemPalace FastAPI bridge
- `desktop/` — Tauri 2 shell (Jarvis window)
- `scripts/setup-local-ai.sh` / `remine-palace.sh` / `dev-all.sh`
- UI: `/jarvis`, `/`, `/chat`, `/open`, `/people`, `/sources`, `/ingest`
