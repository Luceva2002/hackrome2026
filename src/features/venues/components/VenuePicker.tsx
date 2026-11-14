'use client';

import { useMemo, useState } from 'react';
import { MapPin, X } from 'lucide-react';

import { inputClass, labelClass } from '@/components/layout/PageShell';
import { getVenueKind, municipioLabel } from '@/lib/sports/taxonomy';
import { useVenues } from '../hooks/use-venues';
import type { VenueSummary } from '../types';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Scelta di un luogo per nome o via: cerca tra tutti i luoghi già scaricati. */
export function VenuePicker({
  label,
  value,
  onChange,
  filter,
}: {
  label: string;
  value: VenueSummary | null;
  onChange: (v: VenueSummary | null) => void;
  filter?: (v: VenueSummary) => boolean;
}) {
  const { venues, error, reload } = useVenues();
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const t = fold(q.trim());
    if (!venues || t.length < 2) return [];
    return venues
      .filter((v) => (!filter || filter(v)) && (fold(v.name).includes(t) || fold(v.address ?? '').includes(t)))
      .slice(0, 6);
  }, [venues, q, filter]);

  if (value)
    return (
      <div>
        <span className={labelClass}>{label}</span>
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-(--stroke-dark)">
          <MapPin className="w-5 h-5 text-mid shrink-0" aria-hidden />
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-hi truncate">{value.name}</span>
            <span className="block text-[13px] text-mid truncate">{[value.address, municipioLabel(value.municipio)].filter(Boolean).join(' · ')}</span>
          </span>
          <button type="button" onClick={() => onChange(null)} aria-label="Cambia luogo" className="w-9 h-9 rounded-full hover:bg-(--surface-muted) flex items-center justify-center">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>
    );

  return (
    <div>
      <label className={labelClass} htmlFor="venue-picker">
        {label}
      </label>
      <input
        id="venue-picker"
        className={inputClass}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nome del luogo o via"
        autoComplete="off"
      />
      {error && (
        <p className="text-[13px] text-danger mt-1.5">
          Non riesco a caricare i luoghi.{' '}
          <button type="button" className="underline font-bold" onClick={reload}>
            Riprova
          </button>
        </p>
      )}
      {q.trim().length >= 2 && venues && (
        <ul className="mt-2 card rounded-2xl overflow-hidden divide-y divide-(--stroke)">
          {matches.length === 0 && <li className="p-3 text-[14px] text-mid">Nessun luogo con questo nome.</li>}
          {matches.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => onChange(v)} className="w-full text-left p-3 hover:bg-(--surface-muted) flex items-center gap-3">
                <span aria-hidden className="text-[20px]">
                  {getVenueKind(v.kind).emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-hi truncate">{v.name}</span>
                  <span className="block text-[12px] text-mid truncate">{[v.address, municipioLabel(v.municipio)].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
