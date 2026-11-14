/**
 * Client tool che cambiano dati: girano nel browser con il login dell'utente e passano
 * dalle stesse API delle pagine (/api/activities…). Ogni scrittura passa da confirmStore.
 */
import { createActivitySchema } from '@/features/activities/filters';
import type { ActivityWithMe } from '@/features/activities/types';
import { LEVEL_LABELS } from '@/features/activities/types';
import { formatSlot, romeWallToDate } from '@/lib/rome-time';
import { addVenue } from '@/features/venues/hooks/use-venues';
import type { VenueSummary } from '@/features/venues/types';
import { DISCIPLINES, getDiscipline, getVenueKind, NATURE_LABELS, VENUE_KINDS } from '@/lib/sports/taxonomy';

import { confirmStore } from './confirm-store';

type Params = Record<string, unknown>;
const yes = (v: unknown) => v === true || v === 'true';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Le risposte di errore delle API diventano frasi da dire all'utente */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, cache: 'no-store', headers: { 'content-type': 'application/json' } });
  const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
  if (r.ok) return j as T;
  if (r.status === 401) throw new Error('Per farlo devi accedere all’app.');
  if (r.status === 404) throw new Error('Non la trovo: forse è stata tolta.');
  throw new Error(j.message ?? 'Operazione non riuscita, riprova tra poco.');
}

const getActivity = async (id: string) => (await api<{ activity: ActivityWithMe }>(`/api/activities/${id}`)).activity;
const where = (a: Pick<ActivityWithMe, 'venue_name' | 'place_label'>) => a.venue_name ?? a.place_label;

const FIELD: Record<string, string> = {
  title: 'il titolo (almeno 3 lettere)',
  discipline: 'lo sport',
  starts_at: 'la data e l’ora (devono essere nel futuro)',
  ends_at: 'la durata',
  capacity: 'il numero di posti (da 1 a 500)',
  venue_id: 'il luogo',
  level: 'il livello',
  price_note: 'il costo (testo breve)',
  description: 'la descrizione (massimo 600 caratteri)',
};

/** Parole di un sì e riempitivi ammessi: "sì confermo", "ok vai pure", "yes please" */
const YES_WORDS = new Set(['si', 'certo', 'confermo', 'conferma', 'ok', 'okay', 'va', 'bene', 'vai', 'procedi', 'esatto', 'perfetto', 'yes', 'yeah', 'yep', 'sure', 'confirm', 'go', 'ahead']);
const FILLERS = new Set(['pure', 'grazie', 'dai', 'allora', 'please', 'thanks', 'e', 'certamente']);

/** Risposta dell'utente a una domanda: solo un sì ("si chiama Mario" non lo è) */
export const isYes = (said: string) => {
  const w = said.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]+/g, ' ').trim().split(/\s+/);
  return w.length > 0 && w.length <= 5 && YES_WORDS.has(w[0]) && w.every((x) => YES_WORDS.has(x) || FILLERS.has(x));
};

export function writeTools(
  navigate: (url: string) => void,
  locate: () => Promise<{ lat: number; lng: number } | null>,
  /** L'utente ha appena detto sì a una domanda dell'agente */
  saidYes: () => boolean = () => false,
) {
  // Il sì appena detto vale anche se il modello non ha messo `confermato` (l'ha chiesto lui prima)
  const request = (key: string, summary: string, action: string, confirmed: boolean, run: () => Promise<string>) => {
    const voice = saidYes();
    return confirmStore.request(key, summary, action, confirmed || voice, run, voice);
  };

  return {
    iscriviti_attivita: async ({ id, confermato }: Params) => {
      if (typeof id !== 'string' || !UUID.test(id)) return 'Errore: id attività non valido. Usa l’id restituito da cerca_attivita.';
      try {
        const a = await getActivity(id);
        if (a.is_owner) return 'Non serve: l’utente è l’organizzatore di questa attività.';
        if (a.my_status === 'confirmed') return `È già iscritto a «${a.title}».`;
        if (a.my_status === 'waitlist') return `È già in lista d’attesa per «${a.title}».`;
        if (a.status === 'cancelled') return `«${a.title}» è stata annullata: non ci si può iscrivere.`;
        const full = a.spots_left <= 0 ? '. I posti sono finiti: andrai in lista d’attesa' : '';
        const summary = `Ti iscrivo a «${a.title}», ${formatSlot(a.starts_at, a.ends_at)}${where(a) ? `, ${where(a)}` : ''}${full}`;
        return request(`join:${id}`, summary, 'Iscrivimi', yes(confermato), async () => {
          const { status } = await api<{ status: 'confirmed' | 'waitlist' }>(`/api/activities/${id}/join`, { method: 'POST' });
          navigate(`/attivita/${id}`);
          return status === 'confirmed'
            ? `Iscrizione confermata a «${a.title}».`
            : `Sei in lista d’attesa per «${a.title}»: se si libera un posto passi tra i confermati.`;
        });
      } catch (e) {
        return `Errore: ${(e as Error).message}`;
      }
    },

    annulla_iscrizione: async ({ id, confermato }: Params) => {
      if (typeof id !== 'string' || !UUID.test(id)) return 'Errore: id attività non valido.';
      try {
        const a = await getActivity(id);
        if (!a.my_status) return `L’utente non è iscritto a «${a.title}».`;
        const summary = `Annullo la tua iscrizione a «${a.title}», ${formatSlot(a.starts_at, a.ends_at)}`;
        return request(`leave:${id}`, summary, 'Annulla iscrizione', yes(confermato), async () => {
          await api(`/api/activities/${id}/join`, { method: 'DELETE' });
          navigate(`/attivita/${id}`);
          return `Iscrizione a «${a.title}» annullata.`;
        });
      } catch (e) {
        return `Errore: ${(e as Error).message}`;
      }
    },

    crea_attivita: async (p: Params) => {
      const day = String(p.giorno ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const time = String(p.ora ?? '').match(/^(\d{1,2})[:.](\d{2})$/);
      if (!day || !time) return 'Errore: servono giorno (AAAA-MM-GG) e ora (HH:MM). Chiedili all’utente se non li ha detti.';
      const start = romeWallToDate(+day[1], +day[2], +day[3], +time[1], +time[2]);
      const minutes = Number(p.durata_minuti) > 0 ? Math.min(Number(p.durata_minuti), 600) : 90;
      const parsed = createActivitySchema.safeParse({
        title: p.titolo,
        description: p.descrizione ?? '',
        discipline: p.disciplina,
        level: p.livello || 'tutti',
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + minutes * 60000).toISOString(),
        capacity: Number(p.posti),
        venue_id: p.luogo_id,
        accessible: yes(p.accessibile),
        price_note: p.costo ? String(p.costo) : null,
      });
      if (!parsed.success) {
        const missing = [...new Set(parsed.error.issues.map((i) => FIELD[String(i.path[0])] ?? String(i.path[0])))];
        return `Errore: manca o non va bene ${missing.join(', ')}. Chiedilo all’utente.`;
      }
      const d = parsed.data;
      if (getDiscipline(d.discipline).id !== d.discipline) return 'Errore: sport non riconosciuto, usa uno degli id ammessi.';
      try {
        const { venue } = await api<{ venue: { name: string } }>(`/api/venues/${encodeURIComponent(d.venue_id)}`);
        const summary =
          `Creo l’attività «${d.title}»: ${getDiscipline(d.discipline).label.toLowerCase()}, ${formatSlot(d.starts_at, d.ends_at)}, ` +
          `a ${venue.name}, ${d.capacity} posti, ${LEVEL_LABELS[d.level].toLowerCase()}${d.price_note ? `, costo: ${d.price_note}` : ''}`;
        return request(`create:${JSON.stringify(d)}`, summary, 'Crea attività', yes(p.confermato), async () => {
          const { id } = await api<{ id: string }>('/api/activities', { method: 'POST', body: JSON.stringify(d) });
          navigate(`/attivita/${id}`);
          return `Attività «${d.title}» creata, ${formatSlot(d.starts_at, d.ends_at)}. Chi la cerca ora la trova e può iscriversi.`;
        });
      } catch (e) {
        return `Errore: ${(e as Error).message}`;
      }
    },

    annulla_attivita: async ({ id, confermato }: Params) => {
      if (typeof id !== 'string' || !UUID.test(id)) return 'Errore: id attività non valido. Usa l’id da le_mie_attivita.';
      try {
        const a = await getActivity(id);
        if (!a.is_owner) return `Solo chi organizza «${a.title}» può annullarla: l’utente può al massimo annullare la sua iscrizione.`;
        if (a.status === 'cancelled') return `«${a.title}» è già annullata.`;
        const people = a.confirmed_count + a.waitlist_count;
        const summary = `Annullo la tua attività «${a.title}», ${formatSlot(a.starts_at, a.ends_at)}${people ? `: ${people} ${people === 1 ? 'persona iscritta lo vedrà' : 'persone iscritte lo vedranno'}` : ''}`;
        return request(`cancel:${id}`, summary, 'Annulla attività', yes(confermato), async () => {
          await api(`/api/activities/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
          navigate(`/attivita/${id}`);
          return `Attività «${a.title}» annullata.`;
        });
      } catch (e) {
        return `Errore: ${(e as Error).message}`;
      }
    },

    segnala_luogo: async (p: Params) => {
      const name = String(p.nome ?? '').trim();
      const address = String(p.indirizzo ?? '').trim();
      if (name.length < 3) return 'Errore: serve il nome del luogo (almeno 3 lettere). Chiedilo all’utente.';
      const at = yes(p.qui) ? await locate() : null;
      if (yes(p.qui) && !at) return 'Errore: posizione non disponibile. Chiedi l’indirizzo del luogo.';
      if (!at && address.length < 3) return 'Errore: serve l’indirizzo del luogo, oppure qui true se l’utente è lì adesso.';
      const kind = VENUE_KINDS.some((k) => k.id === p.tipo) ? String(p.tipo) : 'spazio_informale';
      const nature = String(p.natura ?? '') in NATURE_LABELS ? String(p.natura) : 'informale';
      const ids = new Set(DISCIPLINES.map((d) => d.id));
      const disciplines = String(p.sport ?? '')
        .split(/[,;]\s*|\s+e\s+/)
        .map((x) => x.trim().toLowerCase())
        .filter((x) => ids.has(x))
        .slice(0, 12);
      const body = {
        name,
        address: address || undefined,
        ...(at ? { latitude: at.lat, longitude: at.lng } : {}),
        kind,
        nature,
        disciplines,
        accessibility: p.accessibile === true || p.accessibile === 'true' ? 'si' : 'da_verificare',
        opening_hours: p.orari ? String(p.orari).slice(0, 200) : undefined,
        description: p.descrizione ? String(p.descrizione).slice(0, 1000) : undefined,
      };
      const summary =
        `Segnalo «${name}»${at ? ' nel punto in cui ti trovi' : `, ${address}`}: ${getVenueKind(kind).label.toLowerCase()}` +
        `${disciplines.length ? `, ${disciplines.map((d) => getDiscipline(d).label.toLowerCase()).join(', ')}` : ''}` +
        `${body.opening_hours ? `, orari: ${body.opening_hours}` : ''}. Comparirà subito sulla mappa come segnalato dalla community`;
      return request(`report:${JSON.stringify(body)}`, summary, 'Segnala luogo', yes(p.confermato), async () => {
        const { venue } = await api<{ venue: VenueSummary }>('/api/venues', { method: 'POST', body: JSON.stringify(body) });
        addVenue(venue);
        navigate(`/mappa?luogo=${encodeURIComponent(venue.id)}`);
        return `«${venue.name}» è sulla mappa${venue.address ? `, ${venue.address}` : ''}. Grazie della segnalazione.`;
      });
    },

    le_mie_attivita: async () => {
      try {
        const { organizzo, partecipo } = await api<{ organizzo: ActivityWithMe[]; partecipo: ActivityWithMe[] }>('/api/activities/mine');
        const future = (a: ActivityWithMe) => new Date(a.starts_at) > new Date();
        const brief = (a: ActivityWithMe) => ({
          id: a.id,
          titolo: a.title,
          quando: formatSlot(a.starts_at, a.ends_at),
          luogo: where(a),
          stato: a.status === 'cancelled' ? 'annullata' : a.my_status === 'waitlist' ? 'in lista d’attesa' : a.is_owner ? 'organizzata da te' : 'iscritto',
          posti_liberi: a.spots_left,
          url: `/attivita/${a.id}`,
        });
        return JSON.stringify({ organizzo: organizzo.filter(future).map(brief), partecipo: partecipo.filter(future).map(brief) });
      } catch (e) {
        return `Errore: ${(e as Error).message}`;
      }
    },
  };
}
