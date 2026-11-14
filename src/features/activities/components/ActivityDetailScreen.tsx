'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Accessibility, BadgeCheck, Loader2, MapPin, Ticket, Users } from 'lucide-react';

import { Notice, PageShell, primaryBtn, quietBtn } from '@/components/layout/PageShell';
import { activityCost, costText } from '@/lib/cost';
import { formatSlot } from '@/lib/rome-time';
import { getDiscipline } from '@/lib/sports/taxonomy';
import { LEVEL_LABELS, type ActivityWithMe } from '../types';
import { spotsText } from './ActivityCard';

export function ActivityDetailScreen({ id }: { id: string }) {
  const [a, setA] = useState<ActivityWithMe | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'missing' | 'ok'>('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/activities/${encodeURIComponent(id)}`);
      if (r.status === 404) return setState('missing');
      if (!r.ok) throw new Error();
      setA((await r.json()).activity);
      setState('ok');
    } catch {
      setState('error');
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (method: 'POST' | 'DELETE' | 'PATCH') => {
    setBusy(true);
    setMsg(null);
    try {
      const r =
        method === 'PATCH'
          ? await fetch(`/api/activities/${id}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) })
          : await fetch(`/api/activities/${id}/join`, { method });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(d.message ?? 'Operazione non riuscita. Riprova.');
      else if (method === 'POST') setMsg(d.status === 'waitlist' ? 'Sei in lista d\'attesa: ti spetta il primo posto che si libera.' : 'Iscrizione confermata.');
      else if (method === 'DELETE') setMsg('Iscrizione annullata.');
      else setMsg('Attività annullata.');
      await load();
    } catch {
      setMsg('Operazione non riuscita. Controlla la connessione.');
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <PageShell title="Attività" back="/attivita" backLabel="Torna alle attività">
      {children}
    </PageShell>
  );
  if (state === 'loading')
    return shell(
      <div className="flex justify-center py-12" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-gold-500" aria-label="Caricamento" />
      </div>,
    );
  if (state === 'missing') return shell(<Notice action={<Link href="/attivita" className={quietBtn}>Vai alla bacheca</Link>}>Questa attività non esiste più.</Notice>);
  if (state === 'error' || !a)
    return shell(<Notice action={<button type="button" onClick={load} className={quietBtn}>Riprova</button>}>Non riesco a caricare l&apos;attività.</Notice>);

  const d = getDiscipline(a.discipline);
  const c = activityCost(a.price_note);
  const past = new Date(a.starts_at) < new Date();
  const cancelled = a.status === 'cancelled';

  return shell(
    <>
      <section className="card rounded-[28px] p-5">
        <p className="text-[13px] font-bold text-gold-600">
          <span aria-hidden>{d.emoji} </span>
          {d.label} · {LEVEL_LABELS[a.level]}
        </p>
        <h2 className="text-[22px] font-bold text-hi leading-tight mt-1" style={{ fontFamily: 'var(--font-display)' }}>
          {a.title}
        </h2>
        <p className="text-[15px] text-hi font-semibold mt-2">{formatSlot(a.starts_at, a.ends_at)}</p>
        {cancelled && <p className="mt-3 rounded-2xl bg-red-50 border border-red-100 text-red-800 text-[14px] font-bold p-3">Attività annullata dall&apos;organizzatore.</p>}

        <ul className="mt-4 space-y-2.5 text-[14px] text-hi">
          <li className="flex items-start gap-2.5">
            <Ticket className="w-4.5 h-4.5 mt-0.5 shrink-0 text-mid" aria-hidden />
            <span>
              <span className="font-bold">{costText(c, true)}</span>
              <span className="block text-[12px] text-mid">
                {c.cost === 'da_verificare' ? 'L\'organizzatore non ha indicato il costo: chiedi prima di andare.' : 'Dichiarato da chi organizza l\'attività.'}
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <MapPin className="w-4.5 h-4.5 mt-0.5 shrink-0 text-mid" aria-hidden />
            <span className="min-w-0">
              {a.venue_name ?? a.place_label ?? 'Luogo da definire'}
              {a.venue_id && (
                <Link href={`/mappa?luogo=${encodeURIComponent(a.venue_id)}`} className="block text-[13px] font-bold underline">
                  Vedi il luogo sulla mappa
                </Link>
              )}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <Users className="w-4.5 h-4.5 mt-0.5 shrink-0 text-mid" aria-hidden />
            <span>{spotsText(a)}</span>
          </li>
          {a.accessible && (
            <li className="flex items-start gap-2.5">
              <Accessibility className="w-4.5 h-4.5 mt-0.5 shrink-0 text-mid" aria-hidden />
              <span>Accessibilità dichiarata</span>
            </li>
          )}
          <li className="flex items-start gap-2.5">
            <BadgeCheck className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${a.owner_is_venue_manager ? 'text-emerald-600' : 'text-mid'}`} aria-hidden />
            <span>
              Organizza {a.owner_name}
              {a.owner_is_venue_manager && <span className="block text-[12px] text-mid">Gestore verificato del luogo</span>}
            </span>
          </li>
        </ul>

        {a.description && <p className="mt-4 text-[14px] text-mid whitespace-pre-line leading-relaxed">{a.description}</p>}
        {a.is_demo && <p className="mt-3 text-[12px] text-low">Attività di esempio per la demo.</p>}
      </section>

      <p className="min-h-6 mt-3 text-[14px] font-semibold text-hi text-center" role="status" aria-live="polite">
        {msg}
      </p>

      <div className="mt-1 flex flex-col gap-3">
        {a.is_owner ? (
          cancelled || past ? null : confirmCancel ? (
            <div className="card rounded-[24px] p-4">
              <p className="text-[14px] text-hi font-semibold">Annullare l&apos;attività? Gli iscritti la vedranno come annullata. Non si può ripristinare.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button type="button" className={quietBtn} onClick={() => setConfirmCancel(false)}>
                  No, tienila
                </button>
                <button type="button" disabled={busy} className={`${quietBtn} text-danger!`} onClick={() => act('PATCH')}>
                  Sì, annulla
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={`${quietBtn} text-danger!`} onClick={() => setConfirmCancel(true)}>
              Annulla l&apos;attività
            </button>
          )
        ) : cancelled || past ? (
          <p className="text-center text-[14px] text-mid">{past && !cancelled ? 'L\'attività è già iniziata.' : ''}</p>
        ) : a.my_status ? (
          <button type="button" disabled={busy} className={quietBtn} onClick={() => act('DELETE')}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
            {a.my_status === 'waitlist' ? 'Esci dalla lista d\'attesa' : 'Annulla la mia iscrizione'}
          </button>
        ) : (
          <button type="button" disabled={busy} className={primaryBtn} onClick={() => act('POST')}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
            {a.spots_left > 0 ? 'Iscriviti' : 'Entra in lista d\'attesa'}
          </button>
        )}
      </div>
    </>,
  );
}
