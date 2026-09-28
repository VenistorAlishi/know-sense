# Смысл — персональная векторная база знаний

Одна база **про Кирилла**: люди, источники, чанки и факты.  
MemPalace подключён как local-first memory sidecar для verbatim recall и чата с памятью.

## Запуск

```bash
npm install
# один процесс Next + MemPalace bridge
npm run dev:all
```

Или раздельно:

```bash
npm run palace   # http://127.0.0.1:3851
npm run dev      # http://127.0.0.1:3847
```

Откройте [http://127.0.0.1:3847](http://127.0.0.1:3847) и чат [http://127.0.0.1:3847/chat](http://127.0.0.1:3847/chat).

### Переменные окружения

| Var | Default | Назначение |
|---|---|---|
| `PALACE_URL` | `http://127.0.0.1:3851` | URL FastAPI-bridge MemPalace |
| `OPENAI_API_KEY` / `LLM_API_KEY` | — | включить LLM-ответ в `/api/chat` |
| `LLM_BASE_URL` / `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` / `OPENAI_MODEL` | `gpt-4o-mini` | модель чата |

Без LLM-ключа чат работает в **extractive** режиме (цитаты из памяти).

## Архитектура

- **Смысл (Next.js)** — Person/Source модель, TG-ingest, UI
- **Palace bridge (`services/palace`)** — FastAPI над MemPalace (`mine` / `search`)
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
- `src/lib/ingest/` — ingest + `palace-sync.ts`
- `src/lib/palace.ts` — клиент sidecar
- `services/palace/` — MemPalace FastAPI bridge
- UI: `/`, `/chat`, `/people`, `/sources`, `/ingest`
