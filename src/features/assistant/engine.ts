import { filtersToSearchParams, type VenueFilters } from '@/features/venues/filters';
import { mapBridge } from '@/features/map/map-bridge';
import { findQuartiereIn } from '@/features/map/areas';
import { parseLocalIntent } from './local-intents';

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

/** Cosa l'assistente può fare sull'app (stessi strumenti per il motore vero). */
export interface AssistantActions {
  /** Naviga a un URL dell'app, es. `/mappa?disciplina=basket&municipio=15` */
  navigate: (url: string) => void;
  /** Movimenti di camera sulla mappa (volo, giro, vista d'insieme) */
  map: typeof mapBridge;
  /** Posizione dell'utente, chiedendo il permesso se serve */
  locate: () => Promise<{ lat: number; lng: number } | null>;
  /** Quanti luoghi corrispondono a questi filtri (dati reali, nessuna stima) */
  count: (filters: VenueFilters) => Promise<number>;
}

export interface AssistantCallbacks {
  onStatus: (s: AssistantStatus) => void;
  onMessage: (m: AssistantMessage) => void;
  act: AssistantActions;
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

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): Recognition | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.rate = 1.05;
    synth.speak(u);
  } catch {
    // sintesi vocale non disponibile: resta la risposta scritta
  }
}

/**
 * Motore locale: voce del browser (Web Speech API) + comprensione locale delle
 * richieste semplici (sport, luogo, Municipio, accessibilità, vicino a me) che
 * diventano filtri della mappa. Non inventa risposte: se non capisce lo dice.
 * Il motore ElevenLabs di Edo lo sostituisce passando un altro `engineFactory`.
 */
export const createLocalEngine: EngineFactory = (cb) => {
  let rec: Recognition | null = null;
  let heard = '';
  let byVoice = false;

  const reply = (text: string) => {
    cb.onMessage({ id: newMessageId(), role: 'assistant', text, at: Date.now() });
    if (byVoice) speak(text);
  };

  const handle = async (text: string) => {
    cb.onMessage({ id: newMessageId(), role: 'user', text, at: Date.now() });
    cb.onStatus('thinking');
    let intent = parseLocalIntent(text);
    const quartiere = await findQuartiereIn(text).catch(() => null);
    if (quartiere) {
      intent ??= { filters: {}, wantsNearMe: false, understood: [] };
      // Il filtro per quartiere non esiste: uso un raggio dal suo centro e lo dico
      intent.filters = { ...intent.filters, municipio: undefined, vicino: { lat: quartiere.ly, lng: quartiere.lx, km: 1.5 } };
      intent.wantsNearMe = false;
      intent.understood = [...intent.understood.filter((u) => !u.startsWith('Municipio')), `entro 1,5 km dal centro di ${quartiere.nome}`];
    }
    if (!intent) {
      cb.onStatus('idle');
      reply('Per ora capisco richieste come “campi da basket accessibili nel Municipio XV” o “piscine vicino a me”. Le domande più libere arriveranno con l’assistente completo.');
      return;
    }
    const filters = { ...intent.filters };
    if (intent.wantsNearMe) {
      const loc = await cb.act.locate();
      if (loc) filters.vicino = { lat: loc.lat, lng: loc.lng, km: 2 };
    }
    const qs = filtersToSearchParams(filters).toString();
    cb.act.navigate(`/mappa${qs ? `?${qs}` : ''}`);
    cb.act.map.send({ type: 'fitResults' });
    cb.onStatus('idle');
    const n = await cb.act.count(filters).catch(() => null);
    const lost = intent.wantsNearMe && !filters.vicino ? ' Non ho la tua posizione, quindi cerco in tutta Roma.' : '';
    const what = intent.understood.join(', ');
    reply(
      n === 0
        ? `Non trovo luoghi per: ${what}.${lost} Prova a togliere un filtro dalla ricerca.`
        : `${n != null ? `Ho trovato ${n.toLocaleString('it-IT')} ${n === 1 ? 'luogo' : 'luoghi'}` : 'Ti mostro sulla mappa'}: ${what}.${lost}`,
    );
  };

  return {
    async startVoice() {
      rec = getRecognition();
      if (!rec) {
        reply('Questo browser non permette di parlare con l’assistente. Puoi scrivermi dalla chat.');
        return;
      }
      heard = '';
      byVoice = true;
      rec.lang = 'it-IT';
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (e) => {
        heard = Array.from(e.results)
          .map((r) => r[0]?.transcript ?? '')
          .join(' ')
          .trim();
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed') reply('Serve il permesso del microfono per parlare con me.');
        cb.onStatus('idle');
      };
      rec.onend = () => {
        if (heard) void handle(heard);
        else cb.onStatus('idle');
        heard = '';
        rec = null;
      };
      cb.onStatus('listening');
      rec.start();
    },
    async stopVoice() {
      if (rec) {
        cb.onStatus('thinking');
        rec.stop();
      }
    },
    async sendText(text) {
      byVoice = false;
      await handle(text);
    },
    dispose() {
      rec?.abort();
    },
  };
};

/** Nome storico: oggi è il motore locale. */
export const createPlaceholderEngine = createLocalEngine;
