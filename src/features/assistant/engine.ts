/**
 * CONTRATTO DELL'ASSISTENTE (punto di aggancio per Edo).
 *
 * La UI (pulsante a destra nel dock + tendina chat) parla solo con un
 * `AssistantEngine`. Oggi c'è `createPlaceholderEngine`, che non inventa nulla
 * e dice che l'assistente non è collegato. Il motore vero (ElevenLabs con
 * client tools, registry in src/lib/tools) implementa la stessa interfaccia e
 * si registra in `AssistantProvider` (src/features/assistant/AssistantProvider.tsx).
 */

export type AssistantStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  at: number;
  /** Fonti citate (es. siti trovati con cerca_sul_web) */
  sources?: { title: string; url: string }[];
}

export interface AssistantCallbacks {
  onStatus: (s: AssistantStatus) => void;
  onMessage: (m: AssistantMessage) => void;
}

export interface AssistantEngine {
  /** Pulsante tenuto premuto: apre il microfono */
  startVoice(): Promise<void>;
  /** Pulsante rilasciato: chiude il turno di parola */
  stopVoice(): Promise<void>;
  /** Messaggio scritto dalla tendina chat */
  sendText(text: string): Promise<void>;
  dispose(): void;
}

export type EngineFactory = (cb: AssistantCallbacks) => AssistantEngine;

let seq = 0;
export const newMessageId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export const createPlaceholderEngine: EngineFactory = (cb) => {
  const reply = (text: string) =>
    cb.onMessage({ id: newMessageId(), role: 'assistant', text, at: Date.now() });
  return {
    async startVoice() {
      cb.onStatus('listening');
    },
    async stopVoice() {
      cb.onStatus('idle');
      reply('L’assistente vocale non è ancora collegato. Intanto puoi usare la ricerca qui accanto.');
    },
    async sendText(text) {
      cb.onMessage({ id: newMessageId(), role: 'user', text, at: Date.now() });
      cb.onStatus('thinking');
      setTimeout(() => {
        cb.onStatus('idle');
        reply('L’assistente non è ancora collegato: presto potrai chiedermi “trovami un campo da basket accessibile vicino a casa”.');
      }, 400);
    },
    dispose() {},
  };
};
