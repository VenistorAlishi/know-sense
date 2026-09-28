import { UploadPanel } from "@/components/upload-panel";

export default function IngestPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Universal ingest
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Загружайте любые текстовые источники в персональную базу Кирилла.
          Первый приоритет — экспорты Telegram Desktop в JSON (
          <code className="rounded bg-[var(--paper-soft)] px-1">result.json</code>
          ).
        </p>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--ink-soft)]">
        <li>Telegram Desktop → Settings → Advanced → Export chat history</li>
        <li>Формат: Machine-readable JSON, без медиа при желании</li>
        <li>Загрузите три самых больших личных переписки — peer станет «близким»</li>
      </ol>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/70 p-5">
        <UploadPanel />
      </div>
    </div>
  );
}
