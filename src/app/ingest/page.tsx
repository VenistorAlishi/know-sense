import { UploadPanel } from "@/components/upload-panel";

export default function IngestPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Universal ingest
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Загружайте источники в персональную базу Кирилла. Приоритет — экспорты
          Telegram Desktop в JSON (
          <code className="rounded bg-[var(--paper-soft)] px-1">result.json</code>
          ). Store v4 учитывает медиа: фото, voice, video, documents, stickers и
          др. — как{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1">Attachment</code>{" "}
          + chunks <code className="rounded bg-[var(--paper-soft)] px-1">media_ref</code>.
        </p>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--ink-soft)]">
        <li>Telegram Desktop → Export chat history → формат JSON</li>
        <li>
          Лучше экспортировать <strong>с медиа</strong> в папку{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1">ChatExport_*</code>
        </li>
        <li>
          Через CLI (WSL):{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1 text-xs">
            npm run ingest -- --type telegram /path/to/ChatExport_*
          </code>{" "}
          — подтянет JSON и скопирует файлы в{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1">data/sources/…/media</code>
        </li>
        <li>
          Либо загрузите один{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1">result.json</code>{" "}
          ниже (медиа без папки экспорта останутся метаданными)
        </li>
      </ol>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/70 p-5">
        <UploadPanel />
      </div>
    </div>
  );
}
