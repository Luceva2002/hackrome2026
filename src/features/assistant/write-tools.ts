/**
 * Client tool che cambiano dati: girano nel browser con il login dell'utente e passano
 * dalle stesse API delle pagine (/api/activities…). Ogni scrittura passa da confirmStore.
 */
import { createActivitySchema } from '@/features/activities/filters';
import type { ActivityWithMe } from '@/features/activities/types';
import { LEVEL_LABELS } from '@/features/activities/types';
import { formatSlot, romeWallToDate } from '@/lib/rome-time';
import { getDiscipline } from '@/lib/sports/taxonomy';

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

export function writeTools(navigate: (url: string) => void) {
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
        return confirmStore.request(`join:${id}`, summary, 'Iscrivimi', yes(confermato), async () => {
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
        return confirmStore.request(`leave:${id}`, summary, 'Annulla iscrizione', yes(confermato), async () => {
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
        return confirmStore.request(`create:${JSON.stringify(d)}`, summary, 'Crea attività', yes(p.confermato), async () => {
          const { id } = await api<{ id: string }>('/api/activities', { method: 'POST', body: JSON.stringify(d) });
          navigate(`/attivita/${id}`);
          return `Attività «${d.title}» creata, ${formatSlot(d.starts_at, d.ends_at)}. Chi la cerca ora la trova e può iscriversi.`;
        });
      } catch (e) {
        return `Errore: ${(e as Error).message}`;
      }
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
