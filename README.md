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

Откройте [http://127.0.0.1:3847](http://127.0.0.1:3847) и чат [http://127.0.0.1:3847/chat](http://127.0.0.1:3847/chat).

Скопируйте [`.env.example`](.env.example) → `.env.local` при необходимости.

### Переменные окружения

| Var | Default | Назначение |
|---|---|---|
| `PALACE_URL` | `http://127.0.0.1:3851` | URL FastAPI-bridge MemPalace |
| `MEMPALACE_EMBEDDING_MODEL` | `embeddinggemma` | multilingual/RU эмбеддер (не MiniLM) |
| `MEMPALACE_LANG` | `ru` | язык palace |
| `LLM_MODEL` / `OLLAMA_MODEL` | `qwen3.5:9b` | модель чата |
| `LLM_BASE_URL` | auto `http://127.0.0.1:11434/v1` | OpenAI-compat (Ollama) |
| `OPENAI_API_KEY` | — | облачный/совместимый API (перебивает auto-Ollama) |

Без Ollama и без ключа чат работает в **extractive** режиме (цитаты из памяти).

## Архитектура

- **Смысл (Next.js)** — Person/Source модель, TG-ingest, UI
- **Palace bridge (`services/palace`)** — FastAPI над MemPalace (`mine` / `search`), эмбеддер **embeddinggemma**
- **Ollama** — локальный LLM для `/api/chat` (auto-detect на `:11434`)
- После ingest чанки синхронизируются в wings (`kirill`, близкие контакты)
- `/api/chat` → palace search (+ local store fallback) → LLM или extractive

## Модель (v2)

- **Person** — Кирилл (`isSelf`) + близкие (`close`) + остальные
- **Source** — `telegram_chat` | `meeting` | `note` | `file` | `other`
- **Chunk** — текстовое окно + локальный эмбеддинг в JSON-store
- **Fact** — эвристические смыслы
- **MemPalace drawers** — verbatim для recall

Хранилище: `data/store/knowledge.json`, сырьё: `data/sources/`, palace: `data/palace/`.

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
curl http://127.0.0.1:3847/api/chat
curl -X POST http://127.0.0.1:3847/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"какие задачи по бюджету?"}'
```

## Структура кода

- `src/lib/types.ts` / `bootstrap.ts` / `store.ts` — персональная БД
- `src/lib/llm.ts` — auto-detect Ollama / OpenAI-compat
- `src/lib/ingest/` — ingest + `palace-sync.ts`
- `src/lib/palace.ts` — клиент sidecar
- `services/palace/` — MemPalace FastAPI bridge
- `scripts/setup-local-ai.sh` / `remine-palace.sh` / `dev-all.sh`
- UI: `/`, `/chat`, `/people`, `/sources`, `/ingest`
