import { UploadPanel } from "@/components/upload-panel";
import { VoiceUpload } from "@/components/voice-upload";
import Link from "next/link";

export default function IngestPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Universal ingest
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Telegram JSON/ZIP, заметки и{" "}
          <a href="#voice" className="underline">
            голосовые
          </a>
          . Live-синк календаря/почты — в{" "}
          <Link href="/settings/connectors" className="underline">
            коннекторах
          </Link>
          .
        </p>
      </div>

      <VoiceUpload />

      <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--ink-soft)]">
        <li>Telegram Desktop → Export chat history → JSON (+ медиа)</li>
        <li>
          ZIP папок{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1">ChatExport_*</code>{" "}
          или CLI{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1 text-xs">
            npm run ingest -- chats.zip
          </code>
        </li>
      </ol>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/70 p-5">
        <UploadPanel />
      </div>
    </div>
  );
}
