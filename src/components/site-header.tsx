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
            векторная память встреч
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[var(--ink-soft)]">
          <Link href="/meetings" className="hover:text-[var(--ink)]">
            Встречи
          </Link>
          <Link href="/people/kirill" className="hover:text-[var(--ink)]">
            Кирилл
          </Link>
          <Link href="/people" className="hover:text-[var(--ink)]">
            Люди
          </Link>
        </nav>
      </div>
    </header>
  );
}
