import { Conversation, type Conversation as Session } from '@elevenlabs/client';

import { areaAtPoint } from '@/features/map/areas';

import { confirmStore } from './confirm-store';
import { screenContext } from './screen-context';
import { isYes, writeTools } from './write-tools';
import { createLocalEngine, newMessageId, type AssistantCallbacks, type AssistantEngine, type EngineFactory } from './engine';

/**
 * Motore ElevenLabs: voce e chat passano dallo stesso agente.
 * - Letture (cerca_impianti, …): l'agente chiama il nostro MCP su /api/mcp.
 * - Schermo (naviga, mappa, posizione): client tool qui sotto, nel browser.
 * Se l'agente non è configurato (503) o non risponde, si usa il motore locale.
 */

type Params = Record<string, unknown>;

/** Client tool: nomi e parametri devono coincidere con la configurazione dell'agente */
function clientTools(act: AssistantCallbacks['act'], saidYes: () => boolean) {
  return {
    naviga: ({ url }: Params) => {
      // safeAppPath dentro act.navigate scarta tutto ciò che non è una pagina dell'app
      act.navigate(String(url ?? ''));
      return 'ok';
    },
    // Niente coordinate dal modello (le inventava): per un luogo preciso si usa naviga con il suo url
    mappa: ({ azione }: Params) => {
      if (azione === 'panoramica') act.map.send({ type: 'overview' });
      else act.map.send({ type: 'fitResults' });
      return 'ok';
    },
    // Con il quartiere l'agente può cercare "in zona" con `zona`, senza indovinare
    // Scritture (iscrizione, creazione…): sempre dopo una conferma, vedi confirm-store.ts
    ...writeTools(act.navigate, act.locate, saidYes),
    posizione: async () => {
      const at = await act.locate();
      if (!at) return 'Posizione non disponibile (permesso negato o GPS spento). Chiedi all’utente il quartiere o un indirizzo.';
      const area = await areaAtPoint(at.lng, at.lat).catch(() => null);
      return JSON.stringify({
        ...at,
        quartiere: area?.nome ?? null,
        municipio: area?.municipio ?? null,
        ...(area ? {} : { nota: 'Fuori dai quartieri di Roma: usa `vicino` con lat e lng.' }),
      });
    },
  };
}

/** "sabato 14 novembre 2026, ore 10:05" (ora di Roma) */
const romeNow = () =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .format(new Date())
    .replace(/ alle ore | alle |, /, ', ore ');

export const createElevenLabsEngine: EngineFactory = (cb) => {
  let session: Session | null = null;
  let voice = false;
  let starting: Promise<Session | null> | null = null;
  let localEngine: AssistantEngine | null = null;
  /** Solo se l'agente non è configurato (503): un errore di rete non spegne ElevenLabs per sempre */
  let notConfigured = false;
  let disposed = false;
  let lastTyped = '';
  // Per non chiedere conferma due volte: l'ultima frase dell'agente era una domanda e l'utente ha detto sì
  let lastAgent = '';
  let lastUser = '';
  let askedBeforeUser = false;
  const heardUser = (text: string) => {
    lastUser = text;
    askedBeforeUser = /\?\s*$/.test(lastAgent.trim());
  };
  // Vale una volta sola: un sì non autorizza anche l'azione dopo
  const saidYes = () => {
    const y = askedBeforeUser && isYes(lastUser);
    askedBeforeUser = false;
    return y;
  };

  // Ultimi scambi: se la sessione si chiude per inattività, la nuova riparte da qui
  const recent: string[] = [];
  const remember = (who: 'Utente' | 'Assistente', text: string) => {
    recent.push(`${who}: ${text.slice(0, 600)}`);
    if (recent.length > 8) recent.shift();
  };
  const say = (text: string) => {
    remember('Assistente', text);
    cb.onMessage({ id: newMessageId(), role: 'assistant', text, at: Date.now() });
  };
  const local = () => (localEngine ??= createLocalEngine(cb));

  // Prima di ogni richiesta l'agente sa cosa c'è sullo schermo (pagina, filtri, luogo aperto con i suoi dati)
  let lastContext = '';
  const syncScreen = async (s: Session) => {
    try {
      const ctx = await screenContext();
      if (ctx === lastContext) return;
      lastContext = ctx;
      s.sendContextualUpdate(ctx);
    } catch {
      // il contesto è un aiuto: se manca, l'agente chiede
    }
  };

  async function open(wantVoice: boolean): Promise<Session | null> {
    cb.onStatus('connecting');
    const r = await fetch('/api/assistant/session', { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) {
      // Non configurato o non raggiungibile: per questa richiesta risponde il motore locale
      notConfigured = r?.status === 503;
      cb.onStatus('idle');
      return null;
    }
    const { signedUrl } = (await r.json()) as { signedUrl: string };
    const s = await Conversation.startSession({
      signedUrl,
      textOnly: !wantVoice,
      // Per "sabato prossimo alle dieci": il modello non sa che giorno è
      dynamicVariables: { oggi: romeNow() },
      clientTools: clientTools(cb.act, saidYes),
      onMessage: ({ message, role }) => {
        if (disposed) return;
        if (role === 'user' && message === lastTyped) return; // già mostrato da sendText
        if (role === 'user') heardUser(message);
        else lastAgent = message;
        remember(role === 'user' ? 'Utente' : 'Assistente', message);
        cb.onMessage({ id: newMessageId(), role: role === 'user' ? 'user' : 'assistant', text: message, at: Date.now() });
        // In chat ElevenLabs non segnala il cambio di turno: la risposta chiude il "sto pensando"
        if (role !== 'user' && !voice) cb.onStatus('idle');
      },
      onModeChange: ({ mode }) => !disposed && cb.onStatus(mode === 'speaking' ? 'speaking' : voice ? 'listening' : 'idle'),
      onError: (message) => {
        console.error('[assistant]', message);
        if (!disposed) cb.onStatus('error');
      },
      onDisconnect: () => {
        session = null;
        if (!disposed) cb.onStatus('idle');
      },
    });
    if (disposed) {
      void s.endSession();
      return null;
    }
    voice = wantVoice;
    session = s;
    lastContext = '';
    await syncScreen(s);
    if (recent.length)
      s.sendContextualUpdate(
        `La conversazione precedente si è chiusa per inattività: riprendila senza salutare. Pagina aperta ora: ${location.pathname}${location.search}. ` +
          `Ultimi messaggi:\n${recent.join('\n')}\nSe l'utente si riferisce a risultati di prima ("il primo", "quello"), rifai la ricerca per avere gli id.`,
      );
    // Conferma col pulsante: l'esito va in chat e l'agente ne viene informato (senza rispondere da solo)
    confirmStore.setNotifier((text) => {
      const result = confirmStore.get()?.result;
      if (result) say(result);
      session?.sendContextualUpdate(text);
    });
    cb.onStatus(wantVoice ? 'listening' : 'idle');
    return s;
  }

  /** Una sola conversazione alla volta; da chat a voce si riapre con il microfono */
  async function ensure(wantVoice: boolean): Promise<Session | null> {
    if (starting) await starting;
    if (session && (voice || !wantVoice)) return session;
    if (session) {
      await session.endSession();
      session = null;
    }
    starting = open(wantVoice).finally(() => (starting = null));
    return starting;
  }

  return {
    async startVoice() {
      if (notConfigured) return local().startVoice();
      try {
        const s = await ensure(true);
        if (!s) return local().startVoice();
        await syncScreen(s);
        s.setMicMuted(false);
        cb.onStatus('listening');
      } catch (e) {
        console.error('[assistant] startVoice', e);
        cb.onStatus('idle');
        say((e as Error)?.name === 'NotAllowedError' ? 'Serve il permesso del microfono per parlare con me.' : 'Non riesco a collegarmi all’assistente. Riprova tra poco.');
      }
    },
    async stopVoice() {
      if (notConfigured || (localEngine && !session)) return local().stopVoice();
      // Fine del turno di parola: l'agente risponde, il microfono resta chiuso fino al prossimo tocco
      if (session && voice) {
        session.setMicMuted(true);
        cb.onStatus('thinking');
      }
    },
    async sendText(text) {
      if (notConfigured) return local().sendText(text);
      lastTyped = text;
      heardUser(text);
      try {
        const s = session ?? (await ensure(false));
        // Il motore locale mostra da sé il messaggio dell'utente
        if (!s) return local().sendText(text);
        remember('Utente', text);
        cb.onMessage({ id: newMessageId(), role: 'user', text, at: Date.now() });
        cb.onStatus('thinking');
        await syncScreen(s);
        s.sendUserMessage(text);
      } catch (e) {
        console.error('[assistant] sendText', e);
        cb.onStatus('idle');
        say('Non riesco a collegarmi all’assistente. Riprova tra poco.');
      }
    },
    dispose() {
      disposed = true;
      confirmStore.setNotifier(null);
      void session?.endSession();
      session = null;
      localEngine?.dispose();
    },
  };
};
