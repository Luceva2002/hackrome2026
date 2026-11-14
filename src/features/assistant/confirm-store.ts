/**
 * Conferma delle azioni che cambiano dati (iscrizione, creazione…), a voce o col pulsante.
 *
 * Il modello chiede l'azione → qui resta "in attesa" e lo schermo mostra Conferma / Annulla.
 * Si esegue solo se: l'utente preme Conferma; oppure il modello richiama lo stesso strumento
 * con gli stessi dati e `confermato: true` DOPO la richiesta; oppure `confermato: true` arriva
 * subito dopo un sì esplicito dell'utente a una domanda dell'agente (il modello spesso chiede
 * "Confermi?" prima di chiamare lo strumento: non si chiede due volte).
 * shortcut: in quel caso si controlla che ci sia stata una domanda e un sì, non che la domanda
 * riassumesse proprio questi dati; il pulsante resta la garanzia forte.
 */
export type ConfirmState = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

export interface PendingAction {
  id: number;
  key: string;
  /** "Ti iscrivo a Yoga al parco, domenica alle 9:00" */
  summary: string;
  /** Testo del pulsante: "Iscrivimi", "Crea attività" */
  action: string;
  state: ConfirmState;
  result?: string;
  run: () => Promise<string>;
}

type Listener = () => void;
let current: PendingAction | null = null;
let seq = 0;
const listeners = new Set<Listener>();
/** Avvisa l'agente di ciò che è successo col pulsante (contextual update di ElevenLabs) */
let notify: ((text: string) => void) | null = null;

const emit = () => listeners.forEach((l) => l());
const set = (p: PendingAction | null) => {
  current = p;
  emit();
};

async function execute(p: PendingAction): Promise<string> {
  set({ ...p, state: 'running' });
  try {
    const result = await p.run();
    if (current?.id === p.id) set({ ...p, state: 'done', result });
    return result;
  } catch (e) {
    const result = (e as Error).message || 'Operazione non riuscita.';
    if (current?.id === p.id) set({ ...p, state: 'error', result });
    return `Errore: ${result}`;
  }
}

export const confirmStore = {
  get: () => current,
  subscribe(l: Listener) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  setNotifier(fn: ((text: string) => void) | null) {
    notify = fn;
  },

  /**
   * Chiamato dal client tool. Prima volta (o dati cambiati): mette in attesa e chiede di confermare.
   * Con `confirmed` e gli stessi dati della richiesta in attesa: esegue.
   */
  async request(
    key: string,
    summary: string,
    action: string,
    confirmed: boolean,
    run: () => Promise<string>,
    /** L'utente ha appena risposto sì a una domanda dell'agente (vedi saidYes): niente seconda domanda */
    voiceYes = false,
  ): Promise<string> {
    if (confirmed && current?.key === key && current.state === 'pending') return execute(current);
    if (confirmed && current?.key === key && current.state === 'done') return `Già fatto: ${current.result}`;
    const p: PendingAction = { id: ++seq, key, summary, action, state: 'pending', run };
    if (confirmed && voiceYes) return execute(p);
    set(p);
    return (
      `IN ATTESA DI CONFERMA, non è ancora stato fatto nulla. Di' all'utente: "${summary}. Confermi?" ` +
      'Sullo schermo c’è anche il pulsante Conferma. Se dice sì, richiama questo strumento con gli stessi parametri e confermato true. ' +
      'Se dice no, non richiamarlo.'
    );
  },

  async confirmByButton() {
    if (current?.state !== 'pending') return;
    const result = await execute(current);
    notify?.(`L’utente ha premuto Conferma sullo schermo. Esito: ${result} Non richiamare lo strumento: è già fatto. Diglielo in una frase.`);
  },

  cancel(byButton = true) {
    if (!current || current.state === 'running') return;
    const was = current.state === 'pending';
    set(null);
    if (byButton && was) notify?.('L’utente ha premuto Annulla sullo schermo: l’azione non è stata fatta. Non richiamare lo strumento.');
  },

  /** Solo per i controlli automatici */
  reset() {
    current = null;
    seq = 0;
    notify = null;
    listeners.clear();
  },
};
