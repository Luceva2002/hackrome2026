'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, MapPinned, User } from 'lucide-react';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { GlassIconButton } from '@/components/ui/GlassIconButton';

const TABS = [
  { href: '/', label: 'Luoghi', icon: MapPinned, match: (p: string) => p === '/' || p.startsWith('/luoghi') },
  { href: '/attivita', label: 'Attività', icon: CalendarDays, match: (p: string) => p.startsWith('/attivita') },
];

/** Barra di navigazione principale: logo, Luoghi | Attività, profilo. */
export function AppNav({ className = '' }: { className?: string }) {
  const pathname = usePathname() ?? '/';
  return (
    <nav aria-label="Navigazione principale" className={`flex items-center justify-between gap-2 ${className}`}>
      <Link href="/" className="glass-heavy rounded-2xl h-12 pl-3.5 pr-4 hidden sm:flex items-center" aria-label="RomaInCampo, home">
        <BrandLogo className="text-[20px]" />
      </Link>
      <Link href="/" className="glass-heavy rounded-2xl h-12 w-12 flex sm:hidden items-center justify-center" aria-label="RomaInCampo, home">
        <BrandLogo className="text-[22px]" markOnly />
      </Link>

      <ul className="glass-heavy rounded-2xl h-12 p-1 flex items-center gap-1">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`h-10 px-4 rounded-xl flex items-center gap-2 text-[14px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600 ${
                  active ? 'bg-ink text-white' : 'text-mid hover:text-hi hover:bg-white'
                }`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <Icon className="w-4 h-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <GlassIconButton href="/profilo" ariaLabel="Il mio profilo" size={48} heavy className="rounded-2xl!">
        <User className="w-5 h-5" aria-hidden />
      </GlassIconButton>
    </nav>
  );
}
