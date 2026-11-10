import { messages } from '@/i18n';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-4">
      <h1 className="text-4xl font-semibold">{messages.app.name}</h1>
      <p className="text-neutral-600">{messages.app.tagline}</p>
    </main>
  );
}
