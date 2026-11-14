'use client';

import Link from 'next/link';
import { User } from 'lucide-react';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { useAuth } from '@/features/auth/hooks/use-auth';

/** Logo a sinistra, profilo in alto a destra. */
export function TopBar() {
  const { user } = useAuth();
  const initial = (user?.user_metadata?.display_name as string | undefined)?.charAt(0) ?? user?.email?.charAt(0);
  return (
    <header className="fixed z-40 top-0 left-0 right-0 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
      <div className="flex items-center justify-between pointer-events-auto">
        <Link href="/" className="liquid-glass rounded-full h-12 pl-3.5 pr-4 flex items-center" aria-label="RomaInCampo, home">
          <BrandLogo className="text-[19px]" />
        </Link>
        <Link
          href="/profilo"
          aria-label={user ? 'Il mio profilo e impostazioni' : 'Accedi o registrati'}
          className="liquid-glass rounded-full w-12 h-12 flex items-center justify-center text-hi"
        >
          {initial ? (
            <span className="w-9 h-9 rounded-full bg-gold-500 text-(--on-gold) font-bold flex items-center justify-center uppercase" aria-hidden>
              {initial}
            </span>
          ) : (
            <User className="w-5 h-5" aria-hidden />
          )}
        </Link>
      </div>
    </header>
  );
}
