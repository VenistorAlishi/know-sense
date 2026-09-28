# Смысл — персональная векторная база знаний

Одна база **про Кирилла**: люди, источники, чанки с эмбеддингами и факты.  
Встречи, Telegram-чаты, заметки и файлы — только источники вокруг человека.

## Запуск

```bash
npm install
npm run dev
```

Откройте [http://127.0.0.1:3847](http://127.0.0.1:3847).

## Модель (v2)

- **Person** — Кирилл (`isSelf`) + близкие (`close`) + остальные
- **Source** — `telegram_chat` | `meeting` | `note` | `file` | `other`
- **Chunk** — текстовое окно + 384-d локальный эмбеддинг
- **Fact** — эвристически извлечённые смыслы (связь, тема, задача, …)

Хранилище: `data/store/knowledge.json`, сырьё: `data/sources/`.

## Telegram → первый корпус

1. Telegram Desktop → Settings → Advanced → **Export chat history**
2. Формат: **Machine-readable JSON**
3. Возьмите три самые большие личные переписки (`result.json`)
4. Загрузите через [/ingest](http://127.0.0.1:3847/ingest) или CLI:

```bash
npm run ingest -- --type telegram ./exports/chat1/result.json ./exports/chat2/result.json ./exports/chat3/result.json
```

Peer каждого личного чата помечается как **близкий контакт**.

## API

```bash
# статус
curl http://127.0.0.1:3847/api/ingest

# загрузка
curl -X POST http://127.0.0.1:3847/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"type":"telegram_chat","filename":"result.json","text":"..."}'

# поиск
curl 'http://127.0.0.1:3847/api/search?q=какие%20задачи'

# люди / источники
curl http://127.0.0.1:3847/api/people
curl http://127.0.0.1:3847/api/sources
```

## Структура кода

- `src/lib/types.ts` — схема v2
- `src/lib/bootstrap.ts` — Person «Кирилл» при пустой базе
- `src/lib/store.ts` — persistence + search
- `src/lib/ingest/` — universal ingest + Telegram/meeting/text адаптеры
- UI: `/` хаб, `/people`, `/sources`, `/ingest`
