'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';

import { Notice, PageShell, primaryBtn, quietBtn } from '@/components/layout/PageShell';
import { activityCost } from '@/lib/cost';
import { activityFiltersToParams, paramsToActivityFilters, type ActivityFilters } from '../filters';
import type { ActivityWithMe } from '../types';
import { ActivityCard } from './ActivityCard';

const QUANDO: { id: NonNullable<ActivityFilters['quando']>; label: string }[] = [
  { id: 'oggi', label: 'Oggi' },
  { id: 'domani', label: 'Domani' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'settimana', label: 'Questa settimana' },
];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`shrink-0 h-10 px-4 rounded-full text-[14px] font-semibold border transition-colors ${
        on ? 'bg-ink text-white border-ink' : 'bg-white text-hi border-(--stroke-dark)'
      }`}
    >
      {children}
    </button>
  );
}

/** Bacheca delle attività (filtri nell'URL) e "Le mie" (tab=mie). */
export function ActivitiesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const qs = params?.toString() ?? '';
  const mine = params?.get('tab') === 'mie';
  const filters = paramsToActivityFilters(new URLSearchParams(qs));
  const onlyFree = params?.get('gratis') === '1';

  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [list, setList] = useState<ActivityWithMe[]>([]);
  const [own, setOwn] = useState<{ organizzo: ActivityWithMe[]; partecipo: ActivityWithMe[] }>({ organizzo: [], partecipo: [] });

  const load = useCallback(async () => {
    setState('loading');
    try {
      if (mine) {
        const r = await fetch('/api/activities/mine');
        if (!r.ok) throw new Error();
        setOwn(await r.json());
      } else {
        const r = await fetch(`/api/activities?${activityFiltersToParams(paramsToActivityFilters(new URLSearchParams(qs)))}`);
        if (!r.ok) throw new Error();
        setList((await r.json()).activities ?? []);
      }
      setState('ok');
    } catch {
      setState('error');
    }
  }, [mine, qs]);
  useEffect(() => {
    load();
  }, [load]);

  const go = (next: ActivityFilters, extra: Record<string, string | null> = {}) => {
    const p = activityFiltersToParams(next);
    if (onlyFree) p.set('gratis', '1');
    for (const [k, v] of Object.entries(extra)) (v == null ? p.delete(k) : p.set(k, v));
    router.replace(`/attivita${p.size ? `?${p}` : ''}`);
  };

  const shown = onlyFree ? list.filter((a) => activityCost(a.price_note).cost === 'gratuito') : list;

  return (
    <PageShell
      title={mine ? 'Le mie attività' : 'Attività'}
      back={mine ? '/profilo' : '/mappa'}
      backLabel={mine ? 'Torna al profilo' : 'Torna alla mappa'}
      action={
        <Link href="/attivita/nuova" aria-label="Proponi un'attività" className="w-11 h-11 rounded-2xl bg-gold-500 text-(--on-gold) flex items-center justify-center">
          <Plus className="w-5 h-5" aria-hidden />
        </Link>
      }
    >
      <div role="tablist" aria-label="Quali attività" className="card rounded-full p-1 grid grid-cols-2 mb-4">
        {[
          { on: !mine, href: '/attivita', label: 'Bacheca' },
          { on: mine, href: '/attivita?tab=mie', label: 'Le mie' },
        ].map((t) => (
          <Link
            key={t.href}
            role="tab"
            aria-selected={t.on}
            href={t.href}
            replace
            className={`h-10 rounded-full flex items-center justify-center text-[14px] font-bold ${t.on ? 'bg-ink text-white' : 'text-hi'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!mine && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-4" aria-label="Filtri">
          {QUANDO.map((q) => (
            <Chip key={q.id} on={filters.quando === q.id} onClick={() => go({ ...filters, quando: filters.quando === q.id ? undefined : q.id })}>
              {q.label}
            </Chip>
          ))}
          <Chip on={onlyFree} onClick={() => go(filters, { gratis: onlyFree ? null : '1' })}>
            Gratuite
          </Chip>
          <Chip on={!!filters.posti_liberi} onClick={() => go({ ...filters, posti_liberi: filters.posti_liberi ? undefined : true })}>
            Posti liberi
          </Chip>
          <Chip on={!!filters.accessibile} onClick={() => go({ ...filters, accessibile: filters.accessibile ? undefined : true })}>
            Accessibili
          </Chip>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex justify-center py-12" role="status">
          <Loader2 className="w-8 h-8 animate-spin text-gold-500" aria-label="Caricamento delle attività" />
        </div>
      )}
      {state === 'error' && (
        <Notice action={<button type="button" onClick={load} className={quietBtn}>Riprova</button>}>Non riesco a caricare le attività. Controlla la connessione.</Notice>
      )}

      {state === 'ok' && !mine && (
        <>
          {filters.luogo && (
            <p className="text-[13px] text-mid mb-3">
              Solo le attività di un luogo.{' '}
              <button type="button" className="underline font-semibold text-hi" onClick={() => go({ ...filters, luogo: undefined })}>
                Mostra tutte
              </button>
            </p>
          )}
          {shown.length === 0 ? (
            <Notice action={<Link href="/attivita/nuova" className={primaryBtn}>Proponi un&apos;attività</Link>}>
              Nessuna attività in programma con questi filtri.
            </Notice>
          ) : (
            <ul className="space-y-3">
              {shown.map((a) => (
                <li key={a.id}>
                  <ActivityCard a={a} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {state === 'ok' && mine && (
        <>
          {own.organizzo.length === 0 && own.partecipo.length === 0 ? (
            <Notice action={<Link href="/attivita" className={primaryBtn}>Guarda la bacheca</Link>}>
              Non organizzi e non partecipi ancora a nessuna attività.
            </Notice>
          ) : (
            [
              { title: 'Le organizzo io', items: own.organizzo, empty: 'Non organizzi attività.' },
              { title: 'Partecipo', items: own.partecipo, empty: 'Non sei iscritto a nessuna attività.' },
            ].map((g) => (
              <section key={g.title} className="mb-6">
                <h2 className="eyebrow mb-2">{g.title}</h2>
                {g.items.length === 0 ? (
                  <p className="text-[14px] text-mid">{g.empty}</p>
                ) : (
                  <ul className="space-y-3">
                    {g.items.map((a) => (
                      <li key={a.id}>
                        <ActivityCard a={a} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </>
      )}
    </PageShell>
  );
}
