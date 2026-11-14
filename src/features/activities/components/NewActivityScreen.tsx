'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { PageShell, inputClass, labelClass, primaryBtn } from '@/components/layout/PageShell';
import { VenuePicker } from '@/features/venues/components/VenuePicker';
import { fetchVenues } from '@/features/venues/hooks/use-venues';
import type { VenueSummary } from '@/features/venues/types';
import { romeWallToDate } from '@/lib/rome-time';
import { DISCIPLINES } from '@/lib/sports/taxonomy';
import { LEVEL_LABELS, type ActivityLevel } from '../types';

export function NewActivityScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const venueId = params?.get('luogo');

  const [venue, setVenue] = useState<VenueSummary | null>(null);
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [level, setLevel] = useState<ActivityLevel>('tutti');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [minutes, setMinutes] = useState(60);
  const [capacity, setCapacity] = useState(10);
  const [free, setFree] = useState<boolean | null>(null);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [accessible, setAccessible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!venueId) return;
    fetchVenues()
      .then((all) => setVenue(all.find((v) => v.id === venueId) ?? null))
      .catch(() => {});
  }, [venueId]);

  // Si propongono per primi gli sport che il luogo dichiara
  const sports = venue?.disciplines.length
    ? [...DISCIPLINES.filter((d) => venue.disciplines.includes(d.id)), ...DISCIPLINES.filter((d) => !venue.disciplines.includes(d.id))]
    : DISCIPLINES;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!venue) return setError('Scegli il luogo dove si svolge l\'attività.');
    if (!discipline) return setError('Scegli lo sport.');
    if (!date) return setError('Scegli il giorno.');
    if (free == null) return setError('Indica se l\'attività è gratuita o a pagamento.');
    if (!free && !price.trim()) return setError('Scrivi il prezzo, per esempio "5 € a persona".');
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const start = romeWallToDate(y, m, d, h, min);
    if (start <= new Date()) return setError('Giorno e ora devono essere nel futuro.');
    setBusy(true);
    try {
      const r = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          discipline,
          level,
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + minutes * 60000).toISOString(),
          capacity,
          venue_id: venue.id,
          accessible,
          price_note: free ? 'Gratuita' : price.trim(),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(r.status === 400 ? 'Controlla i campi: il titolo deve avere almeno 3 caratteri e i posti devono essere tra 1 e 500.' : 'Non sono riuscito a pubblicare l\'attività. Riprova.');
        return;
      }
      router.replace(`/attivita/${data.id}`);
    } catch {
      setError('Non sono riuscito a pubblicare l\'attività. Controlla la connessione.');
    } finally {
      setBusy(false);
    }
  };

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });

  return (
    <PageShell title="Nuova attività" back={venueId ? `/mappa?luogo=${encodeURIComponent(venueId)}` : '/attivita'} backLabel="Indietro">
      <form onSubmit={submit} className="card rounded-[28px] p-5 space-y-4" noValidate>
        <VenuePicker label="Dove" value={venue} onChange={setVenue} />

        <div>
          <label className={labelClass} htmlFor="act-title">
            Titolo
          </label>
          <input id="act-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required placeholder="Es. Calcetto del giovedì" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="act-sport">
              Sport
            </label>
            <select id="act-sport" className={inputClass} value={discipline} onChange={(e) => setDiscipline(e.target.value)} required>
              <option value="">Scegli…</option>
              {sports.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="act-level">
              Livello
            </label>
            <select id="act-level" className={inputClass} value={level} onChange={(e) => setLevel(e.target.value as ActivityLevel)}>
              {(Object.keys(LEVEL_LABELS) as ActivityLevel[]).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="act-date">
              Giorno
            </label>
            <input id="act-date" type="date" className={inputClass} value={date} min={today} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass} htmlFor="act-time">
              Ora (di Roma)
            </label>
            <input id="act-time" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass} htmlFor="act-min">
              Durata
            </label>
            <select id="act-min" className={inputClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[30, 45, 60, 75, 90, 120, 180].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} minuti` : m % 60 === 0 ? `${m / 60} ${m === 60 ? 'ora' : 'ore'}` : `${Math.floor(m / 60)} h ${m % 60} min`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="act-cap">
              Posti
            </label>
            <input id="act-cap" type="number" inputMode="numeric" min={1} max={500} className={inputClass} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} required />
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Costo</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: true, label: 'Gratuita' },
              { v: false, label: 'A pagamento' },
            ].map((o) => (
              <label
                key={o.label}
                className={`h-12 rounded-2xl border flex items-center justify-center gap-2 text-[15px] font-bold cursor-pointer ${
                  free === o.v ? 'bg-ink text-white border-ink' : 'bg-white text-hi border-(--stroke-dark)'
                }`}
              >
                <input type="radio" name="cost" className="sr-only" checked={free === o.v} onChange={() => setFree(o.v)} />
                {o.label}
              </label>
            ))}
          </div>
          {free === false && (
            <div className="mt-3">
              <label className={labelClass} htmlFor="act-price">
                Prezzo
              </label>
              <input id="act-price" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} maxLength={80} placeholder="Es. 5 € a persona" />
            </div>
          )}
        </fieldset>

        <div>
          <label className={labelClass} htmlFor="act-desc">
            Descrizione (facoltativa)
          </label>
          <textarea
            id="act-desc"
            className={`${inputClass} h-28! py-3 resize-none`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={600}
            placeholder="Cosa portare, a chi è rivolta, punto di ritrovo"
          />
        </div>

        <label className="flex items-center gap-3 text-[14px] text-hi font-semibold">
          <input type="checkbox" className="w-5 h-5 accent-(--gold-500)" checked={accessible} onChange={(e) => setAccessible(e.target.checked)} />
          Adatta anche a persone con disabilità
        </label>

        <p className="min-h-5 text-[14px] font-semibold text-danger" role="alert">
          {error}
        </p>
        <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
          Pubblica l&apos;attività
        </button>
      </form>
    </PageShell>
  );
}
