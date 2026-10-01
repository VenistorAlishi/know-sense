import Link from "next/link";
import { LlmSettingsForm } from "@/components/llm-settings-form";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Настройки
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          LLM для чата и{" "}
          <Link
            href="/settings/connectors"
            className="underline decoration-[var(--accent)]"
          >
            коннекторы
          </Link>{" "}
          (календарь, голос, почта/Drive — каркас).
        </p>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/80 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg text-[var(--ink)]">Коннекторы</h2>
          <Link
            href="/settings/connectors"
            className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm text-[var(--paper)]"
          >
            Открыть
          </Link>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Google Calendar OAuth, загрузка голосовых, заготовки Яндекс.Почта / Google Drive.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg text-[var(--ink)]">LLM</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Ключ хранится локально в{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1">
            data/store/llm-settings.json
          </code>
          .
        </p>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/80 p-5">
          <LlmSettingsForm />
        </div>
      </div>
    </div>
  );
}
