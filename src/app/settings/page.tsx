import { LlmSettingsForm } from "@/components/llm-settings-form";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Настройки LLM
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Облачный API для чата с памятью. Ключ хранится только локально в{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1">
            data/store/llm-settings.json
          </code>
          .
        </p>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/80 p-5">
        <LlmSettingsForm />
      </div>
    </div>
  );
}
