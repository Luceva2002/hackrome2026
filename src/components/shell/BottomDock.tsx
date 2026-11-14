'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { House, Map as MapIcon, Search } from 'lucide-react';

import { AssistantButton } from '@/features/assistant/AssistantButton';
import { describeFilters, searchParamsToFilters } from '@/features/venues/filters';
import { useShell } from './ShellProvider';

/**
 * Dock in basso, tre elementi:
 * sinistra Home ↔ Mappa · centro barra di ricerca · destra assistente.
 */
export function BottomDock() {
  const pathname = usePathname() ?? '/';
  const params = useSearchParams();
  const { openSearch } = useShell();
  const onMap = pathname.startsWith('/mappa');
  const summary = onMap ? describeFilters(searchParamsToFilters(new URLSearchParams(params?.toString()))) : '';

  return (
    <nav
      aria-label="Barra principale"
      className="fixed z-40 left-0 right-0 bottom-0 px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="mx-auto max-w-[640px] flex items-center gap-2.5 pointer-events-auto">
        <Link
          href={onMap ? '/' : '/mappa'}
          aria-label={onMap ? 'Torna alla home' : 'Apri la mappa'}
          className="w-16 h-16 shrink-0 rounded-full liquid-glass flex items-center justify-center text-hi active:scale-95 transition-transform"
        >
          {onMap ? <House className="w-7 h-7" aria-hidden /> : <MapIcon className="w-7 h-7" aria-hidden />}
        </Link>

        <button
          type="button"
          onClick={openSearch}
          aria-haspopup="dialog"
          className="flex-1 min-w-0 h-16 rounded-full liquid-glass flex items-center gap-3 px-5 text-left active:scale-[0.99] transition-transform"
        >
          <Search className="w-5 h-5 text-hi shrink-0" aria-hidden />
          <span className="min-w-0 flex flex-col">
            <span className="text-[16px] font-bold text-hi truncate" style={{ fontFamily: 'var(--font-display)' }}>
              {summary ? 'Modifica ricerca' : 'Cerca un luogo'}
            </span>
            <span className="text-[13px] text-mid truncate">{summary || 'Disciplina · Municipio · Accessibilità'}</span>
          </span>
        </button>

        <AssistantButton />
      </div>
    </nav>
  );
}
