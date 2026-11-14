'use client';

import { APP_NAME } from '@/lib/brand';

import Link from 'next/link';
import { User } from 'lucide-react';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { useAuth } from '@/features/auth/hooks/use-auth';

/** Logo a sinistra, profilo in alto a destra. */
export function TopBar() {
  const { user } = useAuth();
  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const initial = (user?.user_metadata?.display_name as string | undefined)?.charAt(0) ?? user?.email?.charAt(0);
  return (
    <header className="fixed z-40 inset-x-0 top-0 px-edge pt-[calc(var(--safe-t)+var(--edge))] pointer-events-none">
      <div className="mx-auto max-w-[560px] lg:max-w-none flex items-center justify-between [&>*]:pointer-events-auto">
        <Link href="/mappa" className="liquid-glass rounded-full h-control pl-3.5 pr-4 flex items-center" aria-label={`${APP_NAME}, mappa`}>
          <BrandLogo className="text-[19px]" />
        </Link>
        <Link
          href="/profilo"
          aria-label={user ? 'Il mio profilo e impostazioni' : 'Accedi o registrati'}
          className="liquid-glass rounded-full w-control h-control flex items-center justify-center text-hi"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : initial ? (
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
