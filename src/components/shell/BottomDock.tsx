'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { House, Map as MapIcon, Search } from 'lucide-react';

import { AssistantButton } from '@/features/assistant/AssistantButton';
import { describeFilters, searchParamsToFilters } from '@/features/venues/filters';
import { useShell } from './ShellProvider';

/**
 * Dock in basso, tre elementi:
 * sinistra Home ↔ Mappa · centro barra di ricerca · destra assistente.
 * Su desktop il dock sale in alto al centro e l'assistente resta in basso a destra.
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
      className="under-sheet fixed z-40 inset-x-0 bottom-0 px-edge pb-[calc(var(--safe-b)+var(--edge))] pointer-events-none lg:bottom-auto lg:top-0 lg:pb-0 lg:pt-[calc(var(--safe-t)+var(--edge))] lg:px-[300px]"
    >
      <div className="mx-auto max-w-[560px] flex items-center gap-(--gap) pointer-events-auto">
        <Link
          href={onMap ? '/home' : '/mappa'}
          aria-label={onMap ? 'Torna alla home' : 'Apri la mappa'}
          className="relative w-dock h-dock shrink-0 rounded-full liquid-glass flex items-center justify-center text-hi active:scale-90 transition-transform duration-200"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={onMap ? 'home' : 'map'}
              initial={{ opacity: 0, scale: 0.5, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 30 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex"
            >
              {onMap ? <House className="w-6 h-6" aria-hidden /> : <MapIcon className="w-6 h-6" aria-hidden />}
            </motion.span>
          </AnimatePresence>
        </Link>

        <button
          type="button"
          onClick={openSearch}
          aria-haspopup="dialog"
          className="flex-1 min-w-0 h-dock rounded-full liquid-glass flex items-center gap-3 pl-5 pr-4 text-left active:scale-[0.98] transition-transform duration-200"
        >
          <Search className="w-5 h-5 text-hi shrink-0" aria-hidden />
          <span className="min-w-0 flex flex-col">
            <span className="text-[16px] leading-tight font-bold text-hi truncate" style={{ fontFamily: 'var(--font-display)' }}>
              {summary ? 'Modifica ricerca' : 'Cerca un luogo'}
            </span>
            <span className="text-[13px] leading-tight text-mid truncate">{summary || 'Sport, zona, accessibilità'}</span>
          </span>
        </button>

        <div className="lg:hidden">
          <AssistantButton />
        </div>
      </div>
      <div className="hidden lg:block fixed z-40 right-edge bottom-[calc(var(--safe-b)+var(--edge))] pointer-events-auto">
        <AssistantButton />
      </div>
    </nav>
  );
}
