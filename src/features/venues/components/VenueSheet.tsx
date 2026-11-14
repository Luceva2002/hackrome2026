'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Accessibility, BadgeCheck, CalendarPlus, ChevronDown, Info, KeyRound, Loader2, MapPin, Navigation, Users } from 'lucide-react';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { useVenuePhoto } from '@/features/photos/use-venue-photo';

import {
  ACCESSIBILITY_LABELS,
  NATURE_LABELS,
  STATUS_LABELS,
  getDiscipline,
  getVenueKind,
  municipioLabel,
} from '@/lib/sports/taxonomy';
import { sourceLabel } from '../sources';
import { distanceKm } from '../filters';
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

function Hero({ venue }: { venue: VenueRecord }) {
  const kind = getVenueKind(venue.kind);
  const { photo, loading } = useVenuePhoto(venue);
  return (
    <div className="relative shrink-0 mx-2 mt-2 h-44 rounded-[26px] overflow-hidden">
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.alt} className="w-full h-full object-cover animate-[fadein_.4s_ease-out]" />
          <a
            href={photo.sourceUrl}
            target="_blank"
            rel="noreferrer"
            title={photo.match}
            className="absolute bottom-2 left-2 right-2 truncate text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black/60 text-white w-fit max-w-[calc(100%-1rem)]"
          >
            Foto: {photo.credit}
          </a>
        </>
      ) : (
        <div
          className={`w-full h-full flex flex-col items-center justify-center gap-1 ${loading ? 'animate-pulse' : ''}`}
          style={{ background: `linear-gradient(135deg, ${kind.color}38, ${kind.color}0f)` }}
        >
          <span className="text-[48px]" aria-hidden>
            {kind.emoji}
          </span>
          <span className="text-[12px] font-semibold text-mid">{loading ? 'Cerco una foto con licenza…' : 'Nessuna foto disponibile'}</span>
        </div>
      )}
    </div>
  );
}

function Fact({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'info' }) {
  const tones = {
    neutral: 'glass-well text-hi',
    good: 'bg-emerald-50 text-emerald-800 border border-emerald-100',
    warn: 'bg-amber-50 text-amber-900 border border-amber-100',
    info: 'bg-sky-50 text-sky-800 border border-sky-100',
  };
  return <li className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-semibold ${tones[tone]}`}>{children}</li>;
}

export function VenueSheet({
  id,
  onClose,
  userLocation,
}: {
  id: string | null;
  onClose: () => void;
  userLocation?: { latitude: number; longitude: number } | null;
}) {
  const [venue, setVenue] = useState<VenueRecord | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    if (!id) {
      setVenue(null);
      return;
    }
    let cancelled = false;
    setState('loading');
    setVenue(null);
    fetch(`/api/venues/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (cancelled) return;
        setVenue(d.venue);
        setState('idle');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const kind = venue ? getVenueKind(venue.kind) : null;
  const dist =
    venue && userLocation && venue.latitude != null && venue.longitude != null
      ? distanceKm({ lat: userLocation.latitude, lng: userLocation.longitude }, { lat: venue.latitude, lng: venue.longitude })
      : null;
  const subtitle = venue
    ? [kind?.label, municipioLabel(venue.municipio), dist != null ? (dist < 1 ? `${Math.round(dist * 1000)} m da te` : `${dist.toFixed(1).replace('.', ',')} km da te`) : null]
        .filter(Boolean)
        .join(' · ')
    : '';
  const notes = venue?.review_notes.filter((n) => !n.startsWith('Posizione non ancora')) ?? [];

  return (
    <BottomSheet
      open={!!id}
      onClose={onClose}
      title={venue?.name ?? (state === 'error' ? 'Scheda non disponibile' : 'Caricamento della scheda…')}
      size="auto"
      backdrop="clear"
      header={venue ? <Hero venue={venue} /> : undefined}
    >
      {!venue ? (
        <div className="flex justify-center py-10" role="status">
          {state === 'error' ? (
            <p className="text-[15px] text-mid">Impossibile caricare la scheda.</p>
          ) : (
            <Loader2 className="w-7 h-7 animate-spin text-gold-600" aria-label="Caricamento" />
          )}
        </div>
      ) : (
        <>
          <p className="text-[14px] text-mid">{subtitle}</p>

          {/* A colpo d'occhio: solo ciò che decide se ci vado */}
          <ul className="flex flex-wrap gap-(--gap) mt-3" aria-label="In breve">
            {venue.status === 'attivo' && <Fact tone="good">● Attivo</Fact>}
            {venue.status !== 'attivo' && venue.status !== 'da_verificare' && <Fact tone="warn">{STATUS_LABELS[venue.status]}</Fact>}
            {venue.accessibility === 'si' && (
              <Fact tone="info">
                <Accessibility className="w-3.5 h-3.5" aria-hidden /> Accessibile
              </Fact>
            )}
            {venue.manager_verified && (
              <Fact tone="good">
                <BadgeCheck className="w-3.5 h-3.5" aria-hidden /> Gestore verificato
              </Fact>
            )}
            {venue.community && (
              <Fact>
                <Users className="w-3.5 h-3.5" aria-hidden /> Della community
              </Fact>
            )}
            {venue.nature !== 'da_verificare' && <Fact>{NATURE_LABELS[venue.nature]}</Fact>}
          </ul>

          {venue.disciplines.length > 0 && (
            <ul className="flex gap-(--gap) mt-4 -mx-pad px-pad overflow-x-auto no-scrollbar" aria-label="Sport">
              {venue.disciplines.map((d) => (
                <li key={d} className="shrink-0 h-9 px-3 rounded-full bg-white border border-(--stroke-dark) text-[13px] font-semibold flex items-center gap-1.5">
                  <span aria-hidden>{getDiscipline(d).emoji}</span>
                  {getDiscipline(d).label}
                </li>
              ))}
            </ul>
          )}

          {venue.address && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-card glass-well">
              <MapPin className="w-5 h-5 text-mid shrink-0" aria-hidden />
              <p className="flex-1 min-w-0 text-[14px] text-hi leading-snug">
                {venue.address}, Roma
                {venue.latitude == null && <span className="block text-[12px] text-mid">Posizione sulla mappa da verificare</span>}
              </p>
              {venue.latitude != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-3.5 rounded-full bg-ink text-white text-[13px] font-bold flex items-center gap-1.5 shrink-0"
                >
                  <Navigation className="w-4 h-4" aria-hidden /> Vai
                </a>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-(--gap) mt-4">
            <Link
              href={`/attivita/nuova?luogo=${encodeURIComponent(venue.id)}`}
              className="h-control rounded-full bg-gold-500 hover:bg-gold-400 active:scale-[0.98] transition-transform text-(--on-gold) font-bold text-[14px] flex items-center justify-center gap-2 shadow-(--shadow-gold)"
            >
              <CalendarPlus className="w-4 h-4" aria-hidden /> Crea attività
            </Link>
            <Link
              href={`/gestore?luogo=${encodeURIComponent(venue.id)}`}
              className="h-control rounded-full glass-well hover:bg-white active:scale-[0.98] transition-transform text-hi font-bold text-[14px] flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" aria-hidden /> Sei il gestore?
            </Link>
          </div>

          {/* Tutto il resto, con la fonte di ogni campo, a richiesta */}
          <details className="group mt-5 rounded-card glass-well">
            <summary className="list-none cursor-pointer flex items-center justify-between px-4 h-control text-[14px] font-bold text-hi">
              Tutti i dati e le fonti
              <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" aria-hidden />
            </summary>
            <div className="px-4 pb-3">
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
            {notes.length > 0 && (
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
          </details>
        </>
      )}
    </BottomSheet>
  );
}
