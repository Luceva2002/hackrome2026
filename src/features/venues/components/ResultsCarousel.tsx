'use client';

import { useEffect, useRef, useState } from 'react';
import { Accessibility, ChevronRight } from 'lucide-react';

import { getDiscipline, getVenueKind } from '@/lib/sports/taxonomy';
import { distanceKm } from '../filters';
import type { VenueSummary } from '../types';

/**
 * Risultati della ricerca sopra il dock: si scorrono e la mappa vola sul luogo al centro.
 * Toccando una scheda si apre il luogo. Con la tastiera (Tab) la camera segue la scheda col focus.
 */
export function ResultsCarousel({
  venues,
  from,
  onFocus,
  onOpen,
}: {
  venues: VenueSummary[];
  /** Punto da cui misurare la distanza (ricerca "vicino") */
  from?: { lat: number; lng: number };
  onFocus: (v: VenueSummary) => void;
  onOpen: (id: string) => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(-1);
  const currentRef = useRef(current);
  currentRef.current = current;
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  const focusAt = (i: number) => {
    const v = venuesRef.current[i];
    if (!v || i === currentRef.current) return;
    setCurrent(i);
    onFocusRef.current(v);
  };

  // Nuova ricerca: si riparte dal primo, senza muovere la camera (la inquadra già la mappa)
  const key = venues.map((v) => v.id).join(',');
  useEffect(() => {
    setCurrent(-1);
    list.current?.scrollTo({ left: 0 });
  }, [key]);

  // Fine dello scorrimento → la scheda più vicina al centro guida la camera
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best = 0;
        let bestD = Infinity;
        Array.from(el.children).forEach((c, i) => {
          const li = c as HTMLElement;
          const d = Math.abs(li.offsetLeft + li.offsetWidth / 2 - mid);
          if (d < bestD) [best, bestD] = [i, d];
        });
        focusAt(best);
      }, 160);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  const n = venues.length;
  return (
    <section aria-label={`Risultati: ${n} ${n === 1 ? 'luogo' : 'luoghi'}`} className="w-full">
      <p className="mx-edge mb-(--gap) liquid-glass rounded-full h-8 px-3 inline-flex items-center text-[13px] font-semibold text-mid">
        {n === 1 ? '1 luogo' : `${n} luoghi · scorri per vederli sulla mappa`}
      </p>
      <ul
        ref={list}
        className="flex gap-(--gap) overflow-x-auto snap-x snap-mandatory px-edge pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {venues.map((v, i) => {
          const kind = getVenueKind(v.kind);
          const km = from && v.latitude != null && v.longitude != null ? distanceKm(from, { lat: v.latitude, lng: v.longitude }) : null;
          return (
            <li key={v.id} className="snap-center shrink-0 w-[min(80vw,300px)]">
              <button
                type="button"
                onClick={() => onOpen(v.id)}
                onFocus={() => focusAt(i)}
                aria-current={i === current ? 'true' : undefined}
                aria-label={`${i + 1} di ${n}: ${v.name}. Apri la scheda`}
                className={`w-full h-[96px] text-left rounded-2xl p-3 flex gap-3 items-start border transition-colors bg-white/95 backdrop-blur ${
                  i === current ? 'border-gold-500 shadow-lg' : 'border-(--stroke) shadow-md'
                }`}
              >
                <span className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] shrink-0" style={{ background: `${kind.color}1a` }} aria-hidden>
                  {kind.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-hi leading-snug truncate">{v.name}</span>
                  <span className="block text-[13px] text-mid truncate">
                    {kind.label}
                    {km != null ? ` · ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`}` : ''}
                  </span>
                  <span className="block text-[12px] text-low truncate mt-0.5">
                    {v.disciplines.slice(0, 3).map((d) => getDiscipline(d).label).join(' · ') || (v.address ?? '')}
                  </span>
                </span>
                <span className="flex flex-col items-end justify-between self-stretch shrink-0">
                  <ChevronRight className="w-4 h-4 text-low" aria-hidden />
                  {v.accessibility === 'si' && <Accessibility className="w-4 h-4 text-sky-700" aria-label="Accessibile" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
