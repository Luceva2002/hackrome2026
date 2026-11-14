import { SkipLink } from '@/components/layout/SkipLink';
import { AppShell } from '@/components/shell/AppShell';
import { RequireAuth } from '@/features/auth/components/RequireAuth';

/** Tutta l'app richiede il login: senza account non si vede nulla (pubbliche solo /auth e le pagine info). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-dvh bg-(--bg) overflow-hidden">
      <SkipLink />
      <RequireAuth>
        <AppShell>
          <main id="contenuto" className="h-full w-full" tabIndex={-1}>
            {children}
          </main>
        </AppShell>
      </RequireAuth>
    </div>
  );
}
