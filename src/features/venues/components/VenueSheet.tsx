'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Accessibility, BadgeCheck, CalendarPlus, ChevronDown, Info, KeyRound, Loader2, MapPin, Users, X } from 'lucide-react';

import {
  ACCESSIBILITY_LABELS,
  NATURE_LABELS,
  STATUS_LABELS,
  getDiscipline,
  getVenueKind,
  municipioLabel,
} from '@/lib/sports/taxonomy';
import { sourceLabel } from '../sources';
import type { FieldSource, VenueField, VenueRecord } from '../types';

const LEVEL_LABELS: Record<string, string> = {
  agonistica: 'Agonistica',
  sportiva: 'Sportiva',
  motoria: 'Motoria',
};

function SourceNote({ fs }: { fs?: FieldSource }) {
  if (!fs) return <span className="text-[12px] text-mid">Fonte: nessuna</span>;
  const s = sourceLabel(fs.source);
  const pct = Math.round(fs.confidence * 100);
  return (
    <details className="group text-[12px] text-mid mt-1">
      <summary className="cursor-pointer list-none inline-flex items-center gap-1 font-semibold hover:text-hi rounded">
        <Info className="w-3 h-3" aria-hidden />
        Fonte: {s.titolo}
        {fs.confidence > 0 && <span className="font-normal"> · affidabilità {pct}%</span>}
        <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" aria-hidden />
      </summary>
      <div className="mt-1 pl-4 border-l-2 border-(--stroke-dark) space-y-0.5">
        {s.ente && <p>{s.ente}{s.licenza ? ` · licenza ${s.licenza}` : ''}</p>}
        {fs.note && <p>{fs.note}</p>}
        {fs.raw && <p className="break-words">Valore originale: “{fs.raw}”</p>}
      </div>
    </details>
  );
}

function Field({
  label,
  field,
  venue,
  children,
}: {
  label: string;
  field: VenueField;
  venue: VenueRecord;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3 border-b border-(--stroke) last:border-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="text-[15px] text-hi mt-1">{children}</dd>
      <dd>
        <SourceNote fs={venue.fields[field]} />
      </dd>
    </div>
  );
}

const ToVerify = () => <span className="text-mid italic">Da verificare</span>;

export function VenueSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [venue, setVenue] = useState<VenueRecord | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!id) {
      setVenue(null);
      return;
    }
    let cancelled = false;
    setState('loading');
    fetch(`/api/venues/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (cancelled) return;
        setVenue(d.venue);
        setState('idle');
        requestAnimationFrame(() => headingRef.current?.focus());
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, onClose]);

  if (!id) return null;

  const kind = venue ? getVenueKind(venue.kind) : null;

  return (
    <aside
      aria-label="Scheda del luogo"
      className="absolute z-30 inset-x-0 bottom-0 max-h-[78dvh] sm:inset-auto sm:right-4 sm:top-24 sm:bottom-4 sm:w-[400px] sm:max-h-none glass-heavy rounded-t-[28px] sm:rounded-[28px] flex flex-col overflow-hidden"
    >
      <div className="flex items-start gap-3 p-5 pb-3">
        {kind && (
          <span
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] shrink-0"
            style={{ background: `${kind.color}1f` }}
            aria-hidden
          >
            {kind.emoji}
          </span>
        )}
        <div className="flex-1 min-w-0">
          {venue ? (
            <>
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-[19px] font-bold text-hi leading-tight outline-none"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {venue.name}
              </h2>
              <p className="text-[13px] text-mid mt-1">
                {kind?.label} · {municipioLabel(venue.municipio)}
              </p>
            </>
          ) : (
            <p className="text-[15px] text-mid" role="status">
              {state === 'error' ? 'Impossibile caricare la scheda.' : 'Caricamento della scheda…'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi la scheda"
          className="w-11 h-11 rounded-full bg-white border border-(--stroke-dark) flex items-center justify-center shrink-0 hover:bg-(--surface-muted)"
        >
          <X className="w-5 h-5" aria-hidden />
        </button>
      </div>

      {state === 'loading' && !venue && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-7 h-7 animate-spin text-gold-600" aria-hidden />
        </div>
      )}

      {venue && (
        <div className="overflow-y-auto px-5 pb-dock sm:pb-6">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {venue.community && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full bg-pink-50 text-pink-800">
                <Users className="w-3.5 h-3.5" aria-hidden /> Segnalato dalla community
              </span>
            )}
            {venue.manager_verified && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
                <BadgeCheck className="w-3.5 h-3.5" aria-hidden /> Gestore verificato
              </span>
            )}
            {venue.accessibility === 'si' && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-800">
                <Accessibility className="w-3.5 h-3.5" aria-hidden /> Accessibilità dichiarata
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <Link
              href={`/attivita/nuova?luogo=${encodeURIComponent(venue.id)}`}
              className="h-12 rounded-2xl bg-gold-500 hover:bg-gold-400 text-(--on-gold) font-bold text-[14px] flex items-center justify-center gap-2 shadow-(--shadow-gold)"
            >
              <CalendarPlus className="w-4 h-4" aria-hidden /> Crea attività
            </Link>
            <Link
              href={`/gestore?luogo=${encodeURIComponent(venue.id)}`}
              className="h-12 rounded-2xl bg-white border border-(--stroke-dark) hover:bg-(--surface-muted) text-hi font-bold text-[14px] flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" aria-hidden /> Sei il gestore?
            </Link>
          </div>

          <dl>
            <Field label="Indirizzo" field="address" venue={venue}>
              {venue.address ? (
                <span className="inline-flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-mid" aria-hidden />
                  {venue.address}, Roma
                </span>
              ) : (
                <ToVerify />
              )}
              {venue.latitude == null && (
                <span className="block text-[13px] text-mid mt-1">Posizione sulla mappa da verificare</span>
              )}
            </Field>
            {venue.fields.position && (
              <Field label="Posizione sulla mappa" field="position" venue={venue}>
                {venue.latitude?.toFixed(5)}, {venue.longitude?.toFixed(5)}
              </Field>
            )}
            <Field label="Municipio" field="municipio" venue={venue}>
              {venue.municipio ? municipioLabel(venue.municipio) : <ToVerify />}
            </Field>
            <Field label="Discipline" field="disciplines" venue={venue}>
              {venue.disciplines.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {venue.disciplines.map((d) => (
                    <span key={d} className="text-[13px] font-semibold px-2.5 py-1 rounded-full bg-white border border-(--stroke-dark)">
                      <span aria-hidden>{getDiscipline(d).emoji} </span>
                      {getDiscipline(d).label}
                    </span>
                  ))}
                </span>
              ) : (
                <ToVerify />
              )}
            </Field>
            <Field label="Accessibilità" field="accessibility" venue={venue}>
              {venue.accessibility === 'da_verificare' ? <ToVerify /> : ACCESSIBILITY_LABELS[venue.accessibility]}
            </Field>
            <Field label="Stato" field="status" venue={venue}>
              {venue.status === 'da_verificare' ? <ToVerify /> : STATUS_LABELS[venue.status]}
            </Field>
            <Field label="Strutture" field="structures" venue={venue}>
              {venue.structures ?? <ToVerify />}
            </Field>
            <Field label="Attività praticate" field="levels" venue={venue}>
              {venue.levels.length ? venue.levels.map((l) => LEVEL_LABELS[l] ?? l).join(', ') : <ToVerify />}
            </Field>
            <Field label="Natura dello spazio" field="nature" venue={venue}>
              {venue.nature === 'da_verificare' ? <ToVerify /> : NATURE_LABELS[venue.nature]}
            </Field>
            <Field label="Orari" field="opening_hours" venue={venue}>
              {venue.opening_hours ?? <ToVerify />}
            </Field>
            <Field label="Contatti" field="phone" venue={venue}>
              {venue.phone || venue.website ? (
                <span className="flex flex-col">
                  {venue.phone && <a className="underline" href={`tel:${venue.phone}`}>{venue.phone}</a>}
                  {venue.website && (
                    <a className="underline break-all" href={venue.website} target="_blank" rel="noreferrer">
                      {venue.website}
                    </a>
                  )}
                </span>
              ) : (
                <ToVerify />
              )}
            </Field>
            {venue.description && (
              <Field label="Descrizione del gestore" field="description" venue={venue}>
                {venue.description}
              </Field>
            )}
          </dl>

          {venue.review_notes.filter((n) => !n.startsWith('Posizione non ancora')).length > 0 && (
            <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-900">
              <p className="font-bold mb-1">Dati in revisione</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {venue.review_notes
                  .filter((n) => !n.startsWith('Posizione non ancora'))
                  .map((n) => (
                    <li key={n}>{n}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
