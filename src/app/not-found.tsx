import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
        Не найдено
      </h1>
      <p className="text-[var(--muted)]">Такой встречи или человека нет в базе.</p>
      <Link href="/" className="text-[var(--accent-deep)] hover:underline">
        На главную
      </Link>
    </div>
  );
}
