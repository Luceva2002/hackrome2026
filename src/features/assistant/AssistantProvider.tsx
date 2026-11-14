'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentLocation } from '@/lib/geo';
import { safeAppPath } from '@/lib/safe-path';
import { mapBridge } from '@/features/map/map-bridge';
import { filterVenues } from '@/features/venues/filters';
import { fetchVenues } from '@/features/venues/hooks/use-venues';

import {
  createPlaceholderEngine,
  type AssistantEngine,
  type AssistantMessage,
  type AssistantStatus,
  type EngineFactory,
} from './engine';

interface AssistantContextValue {
  status: AssistantStatus;
  messages: AssistantMessage[];
  chatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  startVoice: () => void;
  stopVoice: () => void;
  sendText: (text: string) => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

const STATUS_ANNOUNCE: Record<AssistantStatus, string> = {
  idle: '',
  connecting: 'Collegamento all’assistente…',
  listening: 'Ti sto ascoltando',
  thinking: 'Sto pensando',
  speaking: 'L’assistente sta rispondendo',
  error: 'L’assistente non è disponibile',
};

/**
 * Edo: sostituisci `engineFactory` con il motore ElevenLabs (stessa interfaccia).
 * Tutto il resto della UI non cambia.
 */
export function AssistantProvider({
  children,
  engineFactory = createPlaceholderEngine,
}: {
  children: React.ReactNode;
  engineFactory?: EngineFactory;
}) {
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const engine = useRef<AssistantEngine | null>(null);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    engine.current = engineFactory({
      onStatus: setStatus,
      onMessage: (m) => setMessages((prev) => [...prev, m]),
      act: {
        navigate: (url) => {
          // Il motore vocale è un modello: niente URL esterni, solo pagine dell'app
          const path = safeAppPath(url);
          if (!path) return;
          // Sulla mappa si sostituisce: ogni frase non deve riempire la cronologia
          const stay = window.location.pathname === '/mappa' && path.startsWith('/mappa');
          if (stay) routerRef.current.replace(path, { scroll: false });
          else routerRef.current.push(path, { scroll: false });
        },
        map: mapBridge,
        count: async (f) => filterVenues(await fetchVenues(), f).length,
        locate: async () => {
          try {
            const l = await getCurrentLocation();
            return { lat: l.latitude, lng: l.longitude };
          } catch {
            return null;
          }
        },
      },
    });
    return () => engine.current?.dispose();
  }, [engineFactory]);

  const startVoice = useCallback(() => void engine.current?.startVoice(), []);
  const stopVoice = useCallback(() => void engine.current?.stopVoice(), []);
  const sendText = useCallback((t: string) => {
    if (t.trim()) void engine.current?.sendText(t.trim());
  }, []);

  // Stabili: BottomSheet rilancia il suo effetto (e sposta il focus) se onClose cambia
  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  const value = useMemo(
    () => ({ status, messages, chatOpen, openChat, closeChat, startVoice, stopVoice, sendText }),
    [status, messages, chatOpen, openChat, closeChat, startVoice, stopVoice, sendText],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
      {/* Stato annunciato agli screen reader */}
      <p className="sr-only" role="status" aria-live="polite">
        {STATUS_ANNOUNCE[status]}
      </p>
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant fuori da AssistantProvider');
  return ctx;
}
