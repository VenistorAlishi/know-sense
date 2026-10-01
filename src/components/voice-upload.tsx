"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function VoiceUpload() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <div id="voice" className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--paper)]/70 p-5">
      <h2 className="text-lg text-[var(--ink)]">Голосовая заметка</h2>
      <p className="text-sm text-[var(--muted)]">
        Загрузите ogg/mp3/wav/m4a. Транскрипт: локальный Whisper /{" "}
        <code className="rounded bg-[var(--paper-soft)] px-1">faster-whisper</code> / OpenAI
        Whisper API.
      </p>
      <input
        type="file"
        accept="audio/*,.ogg,.mp3,.wav,.m4a,.webm"
        disabled={pending}
        className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:font-medium file:text-[var(--ink)]"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setError(null);
          setOk(null);
          const fd = new FormData();
          fd.append("file", file);
          startTransition(async () => {
            const res = await fetch("/api/ingest/voice", {
              method: "POST",
              body: fd,
            });
            const data = await res.json();
            if (!res.ok) {
              setError(data.detail || data.error || "Ошибка");
              return;
            }
            setOk(
              data.asrReady
                ? `Транскрипт (${data.engine}): ${String(data.transcript).slice(0, 120)}…`
                : `Файл сохранён без ASR (${data.engine}). Установите Whisper или OPENAI_API_KEY.`,
            );
            if (data.sourceId) {
              router.push(`/sources/${data.sourceId}`);
              router.refresh();
            }
          });
        }}
      />
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      {ok && (
        <p className="text-sm text-[var(--ok)]" role="status">
          {ok}
        </p>
      )}
      {pending && <p className="text-sm text-[var(--muted)]">Транскрибирую…</p>}
    </div>
  );
}
