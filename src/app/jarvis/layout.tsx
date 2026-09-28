export default function JarvisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[var(--ink)]">
      {children}
    </div>
  );
}
