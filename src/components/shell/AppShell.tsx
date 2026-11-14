'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';

import { AssistantProvider } from '@/features/assistant/AssistantProvider';
import { AssistantSheet } from '@/features/assistant/AssistantSheet';
import { SearchSheet } from '@/features/search/SearchSheet';
import { BottomDock } from './BottomDock';
import { ShellProvider } from './ShellProvider';
import { TopBar } from './TopBar';

/** Struttura comune: top bar, dock in basso, tendine di ricerca e assistente. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const ownHeader = pathname.startsWith('/profilo');
  return (
    <ShellProvider>
      <AssistantProvider>
        {!ownHeader && <TopBar />}
        {children}
        <Suspense>
          <BottomDock />
          <SearchSheet />
        </Suspense>
        <AssistantSheet />
      </AssistantProvider>
    </ShellProvider>
  );
}
