import Link from "next/link";
import { ExtractPanel } from "@/components/extract-panel";

export const dynamic = "force-dynamic";

export default function ExtractPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Extract
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Ночной/ручной воркер: LLM → кандидаты Fact. Проверка на{" "}
          <Link href="/open" className="underline decoration-[var(--accent)]">
            /open
          </Link>
          .
        </p>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/80 p-5">
        <ExtractPanel />
      </div>
    </div>
  );
}
