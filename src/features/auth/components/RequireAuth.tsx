'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { GuestContext, hasGuestCookie, isGuestPath, leaveGuest } from '@/features/auth/guest';

/**
 * Protegge tutta l'app (layout di (app)); rimanda al login e poi torna qui.
 * Chi ha scelto "Visualizza come ospite" vede solo mappa e Home, senza assistente.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const { user, loading } = useAuth();
  // Il cookie si legge solo nel browser: fino ad allora vale lo spinner
  const [guestCookie, setGuestCookie] = useState<boolean | null>(null);
  useEffect(() => setGuestCookie(hasGuestCookie()), [pathname]);

  // Con un account la modalità ospite non serve più
  useEffect(() => {
    if (user) leaveGuest();
  }, [user]);

  const guest = !user && !!guestCookie && isGuestPath(pathname);
  const ready = !loading && guestCookie !== null;

  useEffect(() => {
    // Con la query: i filtri nell'URL (link condivisi, voce) sopravvivono al login
    if (ready && !user && !guest) router.replace(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [user, ready, guest, router, pathname]);

  if (!ready || (!user && !guest)) {
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
  return <GuestContext.Provider value={guest}>{children}</GuestContext.Provider>;
}
