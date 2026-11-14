'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '@/features/auth/hooks/use-auth';

/** Protegge tutta l'app (layout di (app)); rimanda al login e poi torna qui. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Con la query: i filtri nell'URL (link condivisi, voce) sopravvivono al login
    if (!loading && !user) router.replace(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="h-full flex items-center justify-center bg-(--bg)" role="status" aria-live="polite">
        <span className="sr-only">Caricamento…</span>
        <div className="relative w-12 h-12" aria-hidden>
          <span className="absolute inset-0 rounded-full border-2 border-(--gold-500)/25" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-500 animate-spin" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
