import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <section className="desktop-window grid w-full max-w-3xl overflow-hidden rounded-sm md:grid-cols-[0.85fr_1fr]">
        <div className="grid content-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] p-8 md:border-b-0 md:border-r">
          <p className="text-3xl font-bold tracking-[0.16em] text-[var(--accent)]">
            KAGU
          </p>
          <h1 className="text-xl font-semibold text-[var(--ink)]">
            Operasyon Paneli
          </h1>
          <p className="text-sm text-[var(--muted)]">
            KAGU Web Muhasebe
          </p>
        </div>
        <div className="bg-white p-8">
          <LoginForm nextPath={params?.next} />
        </div>
      </section>
    </main>
  );
}
