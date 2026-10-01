import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--line)]/70 bg-[var(--paper)]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)] transition group-hover:text-[var(--accent-deep)]">
            Смысл
          </span>
          <span className="hidden text-xs uppercase tracking-[0.18em] text-[var(--muted)] sm:inline">
            персональная векторная память
          </span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-3 text-sm text-[var(--ink-soft)] sm:gap-4">
          <Link
            href="/jarvis"
            className="rounded-md bg-[var(--ink)] px-2.5 py-1 font-medium text-[var(--wash)] hover:bg-[var(--accent-deep)]"
          >
            Jarvis
          </Link>
          <Link href="/chat" className="hover:text-[var(--ink)]">
            Чат
          </Link>
          <Link href="/open" className="hover:text-[var(--ink)]">
            Открытое
          </Link>
          <Link href="/people" className="hover:text-[var(--ink)]">
            Люди
          </Link>
          <Link href="/sources" className="hover:text-[var(--ink)]">
            Источники
          </Link>
          <Link href="/ingest" className="hover:text-[var(--ink)]">
            Ingest
          </Link>
          <Link href="/extract" className="hover:text-[var(--ink)]">
            Extract
          </Link>
          <Link href="/settings/connectors" className="hover:text-[var(--ink)]">
            Коннекторы
          </Link>
          <Link href="/settings" className="hover:text-[var(--ink)]">
            API
          </Link>
          <Link
            href="/people/kirill"
            className="rounded-md bg-[var(--accent)] px-2.5 py-1 font-medium text-[var(--ink)]"
          >
            Кирилл
          </Link>
        </nav>
      </div>
    </header>
  );
}
