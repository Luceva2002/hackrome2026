import { SkipLink } from '@/components/layout/SkipLink';
import { AppShell } from '@/components/shell/AppShell';

/** Home, mappa, schede e bacheca sono pubbliche: il login si chiede solo all'azione. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-dvh bg-(--bg) overflow-hidden">
      <SkipLink />
      <AppShell>
        <main id="contenuto" className="h-full w-full" tabIndex={-1}>
          {children}
        </main>
      </AppShell>
    </div>
  );
}
