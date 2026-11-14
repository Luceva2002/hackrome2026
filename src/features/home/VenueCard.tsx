'use client';

import Link from 'next/link';
import { Accessibility, BadgeCheck } from 'lucide-react';

import { getDiscipline, getVenueKind, municipioLabel } from '@/lib/sports/taxonomy';
import type { VenueSummary } from '@/features/venues/types';

export interface VenuePhoto {
  url: string;
  /** Obbligatoria: da dove viene la foto (es. "Wikimedia Commons, CC BY-SA"). */
  credit: string;
  alt: string;
}

/**
 * Card stile "annuncio": immagine in alto, nome, zona, descrizione breve.
 * Non abbiamo foto verificate: senza `photo` mostriamo un segnaposto dichiarato,
 * mai un'immagine di repertorio che sembri il luogo vero.
 */
export function VenueCard({
  venue,
  reason,
  distanceKm,
  photo,
}: {
  venue: VenueSummary;
  reason?: string;
  distanceKm?: number;
  photo?: VenuePhoto;
}) {
  const kind = getVenueKind(venue.kind);
  const disciplines = venue.disciplines.slice(0, 3).map((d) => getDiscipline(d).label);
  const description = venue.structures ?? (disciplines.length ? disciplines.join(' · ') : 'Dettagli da verificare');

  return (
    <li className="snap-start shrink-0 w-[78vw] max-w-[300px] sm:w-[280px]">
      <Link
        href={`/mappa?luogo=${encodeURIComponent(venue.id)}`}
        className="group block rounded-[26px] focus-visible:outline-offset-4"
      >
        <div className="relative aspect-[4/3] rounded-[22px] overflow-hidden">
          {photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.alt} className="w-full h-full object-cover" loading="lazy" />
              <span className="absolute bottom-2 right-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white">
                {photo.credit}
              </span>
            </>
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-1"
              style={{ background: `linear-gradient(135deg, ${kind.color}33, ${kind.color}0d)` }}
            >
              <span className="text-[44px]" aria-hidden>
                {kind.emoji}
              </span>
              <span className="text-[12px] font-semibold text-mid">Nessuna foto disponibile</span>
            </div>
          )}
          {reason && (
            <span className="absolute top-2.5 left-2.5 liquid-glass rounded-full px-2.5 py-1 text-[12px] font-bold text-hi">
              {reason}
            </span>
          )}
        </div>
        <div className="px-1 pt-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-bold text-hi leading-snug line-clamp-2 group-hover:underline">{venue.name}</h3>
            {distanceKm != null && (
              <span className="text-[13px] font-semibold text-mid shrink-0">
                {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1).replace('.', ',')} km`}
              </span>
            )}
          </div>
          <p className="text-[13px] text-mid mt-0.5">
            {kind.label} · {municipioLabel(venue.municipio)}
          </p>
          <p className="text-[13px] text-mid mt-0.5 line-clamp-1">{description}</p>
          <p className="flex gap-2 mt-1.5">
            {venue.manager_verified && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-800">
                <BadgeCheck className="w-3.5 h-3.5" aria-hidden /> Gestore verificato
              </span>
            )}
            {venue.accessibility === 'si' && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold text-sky-800">
                <Accessibility className="w-3.5 h-3.5" aria-hidden /> Accessibile
              </span>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
}
