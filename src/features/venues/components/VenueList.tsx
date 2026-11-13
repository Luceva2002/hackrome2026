'use client';

import { memo } from 'react';
import { Accessibility, BadgeCheck, MapPinOff, Users } from 'lucide-react';

import { getDiscipline, getVenueKind, municipioLabel, STATUS_LABELS } from '@/lib/sports/taxonomy';
import type { VenueSummary } from '../types';

const PAGE = 60;

export const VenueRow = memo(function VenueRow({
  venue,
  selected,
  onSelect,
}: {
  venue: VenueSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const kind = getVenueKind(venue.kind);
  const noPos = venue.latitude == null;
  const inactive = venue.status !== 'attivo' && venue.status !== 'da_verificare';
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(venue.id)}
        aria-current={selected ? 'true' : undefined}
        className={`w-full text-left rounded-2xl p-3 flex gap-3 items-start transition-colors border ${
          selected ? 'bg-(--gold-tint) border-gold-500' : 'bg-white border-(--stroke) hover:bg-(--surface-muted)'
        }`}
      >
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] shrink-0"
          style={{ background: `${kind.color}1a` }}
          aria-hidden
        >
          {kind.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-hi leading-snug">{venue.name}</span>
          <span className="block text-[13px] text-mid mt-0.5 truncate">
            {kind.label} · {venue.address ?? 'indirizzo da verificare'} · {municipioLabel(venue.municipio)}
          </span>
          <span className="flex flex-wrap gap-1.5 mt-1.5">
            {venue.community && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-pink-800">
                <Users className="w-3 h-3" aria-hidden /> Segnalato dalla community
              </span>
            )}
            {venue.manager_verified && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                <BadgeCheck className="w-3 h-3" aria-hidden /> Gestore verificato
              </span>
            )}
            {venue.accessibility === 'si' && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800">
                <Accessibility className="w-3 h-3" aria-hidden /> Accessibile
              </span>
            )}
            {inactive && (
              <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-800">
                {STATUS_LABELS[venue.status]}
              </span>
            )}
            {noPos && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full bg-(--bg-deep) text-mid">
                <MapPinOff className="w-3 h-3" aria-hidden /> Posizione da verificare
              </span>
            )}
            {venue.disciplines.slice(0, 3).map((d) => (
              <span key={d} className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-(--surface-muted) text-mid border border-(--stroke)">
                {getDiscipline(d).label}
              </span>
            ))}
            {venue.disciplines.length > 3 && (
              <span className="text-[12px] font-semibold text-mid py-0.5">+{venue.disciplines.length - 3}</span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
});

export function VenueList({
  venues,
  selectedId,
  onSelect,
  limit,
  onMore,
}: {
  venues: VenueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  limit: number;
  onMore: () => void;
}) {
  if (!venues.length) {
    return (
      <p className="text-center text-[14px] text-mid py-10 px-6 leading-relaxed">
        Nessun luogo corrisponde ai filtri.
        <br />
        Prova ad allargare la ricerca o ad azzerare i filtri.
      </p>
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-2" aria-label="Risultati">
        {venues.slice(0, limit).map((v) => (
          <VenueRow key={v.id} venue={v} selected={v.id === selectedId} onSelect={onSelect} />
        ))}
      </ul>
      {venues.length > limit && (
        <button
          type="button"
          onClick={onMore}
          className="w-full mt-3 h-12 rounded-2xl card text-[14px] font-bold text-hi hover:bg-(--surface-muted)"
        >
          Mostra altri {Math.min(PAGE, venues.length - limit)} luoghi
        </button>
      )}
    </>
  );
}

export const LIST_PAGE = PAGE;
