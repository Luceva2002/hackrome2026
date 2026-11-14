'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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

  useEffect(() => {
    engine.current = engineFactory({
      onStatus: setStatus,
      onMessage: (m) => setMessages((prev) => [...prev, m]),
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
