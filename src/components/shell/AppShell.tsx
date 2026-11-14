'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';

import { AssistantProvider } from '@/features/assistant/AssistantProvider';
import { createElevenLabsEngine } from '@/features/assistant/elevenlabs-engine';
import { AssistantSheet } from '@/features/assistant/AssistantSheet';
import { VoiceStatus } from '@/features/assistant/VoiceStatus';
import { SearchSheet } from '@/features/search/SearchSheet';
import { BottomDock } from './BottomDock';
import { ShellProvider } from './ShellProvider';
import { TopBar } from './TopBar';

/** Struttura comune: top bar, dock in basso, tendine di ricerca e assistente. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const ownHeader = ['/profilo', '/attivita', '/gestore', '/admin'].some((p) => pathname.startsWith(p));
  return (
    <ShellProvider>
      <AssistantProvider engineFactory={createElevenLabsEngine}>
        {!ownHeader && <TopBar />}
        {children}
        <Suspense>
          <BottomDock />
          <SearchSheet />
        </Suspense>
        <VoiceStatus />
        <AssistantSheet />
      </AssistantProvider>
    </ShellProvider>
  );
}
