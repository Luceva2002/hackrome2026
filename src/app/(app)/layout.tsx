import { SkipLink } from '@/components/layout/SkipLink';

/** Mappa, schede e bacheca sono pubbliche: il login si chiede solo all'azione. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-dvh bg-(--bg) overflow-hidden">
      <SkipLink />
      <main id="contenuto" className="h-full w-full" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
