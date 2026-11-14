'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, Clock, Loader2, XCircle } from 'lucide-react';

import { Notice, PageShell, inputClass, labelClass, primaryBtn, quietBtn } from '@/components/layout/PageShell';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { VenuePicker } from '@/features/venues/components/VenuePicker';
import { fetchVenues } from '@/features/venues/hooks/use-venues';
import type { VenueSummary } from '@/features/venues/types';
import { COST_LABELS, type Cost } from '@/lib/cost';
import { ACCESSIBILITY_LABELS, STATUS_LABELS, municipioLabel, type Accessibility, type OperationalStatus } from '@/lib/sports/taxonomy';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Claim {
  id: string;
  venue_id: string;
  org_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}
interface Managed {
  id: string;
  name: string;
  address: string | null;
  municipio: number | null;
  opening_hours: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  status: OperationalStatus;
  accessibility: Accessibility;
  accessibility_notes: string | null;
  cost?: Cost;
  cost_price?: string | null;
  cost_note?: string | null;
}

const CLAIM_STATUS = {
  pending: { label: 'In attesa di verifica', icon: Clock, tone: 'text-amber-700' },
  approved: { label: 'Approvata', icon: BadgeCheck, tone: 'text-emerald-700' },
  rejected: { label: 'Non approvata', icon: XCircle, tone: 'text-red-700' },
} as const;

function VenueEditor({ venue, onSaved }: { venue: Managed; onSaved: () => void }) {
  const [v, setV] = useState(venue);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const hasCost = venue.cost !== undefined;
  const set = <K extends keyof Managed>(k: K, val: Managed[K]) => setV((cur) => ({ ...cur, [k]: val }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    if (v.website && !/^https?:\/\//i.test(v.website)) return setMsg({ ok: false, text: 'Il sito deve iniziare con https://' });
    if (hasCost && v.cost === 'a_pagamento' && !v.cost_price?.trim()) return setMsg({ ok: false, text: 'Scrivi il prezzo, per esempio "da 8 € l\'ora".' });
    setBusy(true);
    setMsg(null);
    const clean = (s: string | null | undefined) => s?.trim() || null;
    const patch: Record<string, unknown> = {
      opening_hours: clean(v.opening_hours),
      phone: clean(v.phone),
      website: clean(v.website),
      description: clean(v.description),
      status: v.status,
      accessibility: v.accessibility,
      accessibility_notes: clean(v.accessibility_notes),
    };
    if (hasCost) {
      patch.cost = v.cost;
      patch.cost_price = v.cost === 'a_pagamento' ? clean(v.cost_price) : null;
      patch.cost_note = v.cost === 'da_verificare' ? null : clean(v.cost_note);
    }
    const { error } = await sb.from('venues').update(patch).eq('id', venue.id);
    setBusy(false);
    if (error) setMsg({ ok: false, text: 'Salvataggio non riuscito. Riprova.' });
    else {
      setMsg({ ok: true, text: 'Salvato. Sulla scheda questi dati hanno ora come fonte "gestore verificato".' });
      onSaved();
    }
  };

  const fid = (k: string) => `${venue.id}-${k}`;
  return (
    <form onSubmit={save} className="card rounded-[28px] p-5 space-y-4">
      <div>
        <h3 className="text-[17px] font-bold text-hi" style={{ fontFamily: 'var(--font-display)' }}>
          {venue.name}
        </h3>
        <p className="text-[13px] text-mid">{[venue.address, municipioLabel(venue.municipio)].filter(Boolean).join(' · ')}</p>
        <p className="text-[12px] text-low mt-1">Nome, indirizzo e posizione vengono dalle fonti pubbliche e non si modificano da qui.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor={fid('status')}>
            Stato
          </label>
          <select id={fid('status')} className={inputClass} value={v.status} onChange={(e) => set('status', e.target.value as OperationalStatus)}>
            {(Object.keys(STATUS_LABELS) as OperationalStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={fid('acc')}>
            Accessibilità
          </label>
          <select id={fid('acc')} className={inputClass} value={v.accessibility} onChange={(e) => set('accessibility', e.target.value as Accessibility)}>
            {(Object.keys(ACCESSIBILITY_LABELS) as Accessibility[]).map((s) => (
              <option key={s} value={s}>
                {ACCESSIBILITY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor={fid('accn')}>
          Note sull&apos;accessibilità
        </label>
        <input id={fid('accn')} className={inputClass} value={v.accessibility_notes ?? ''} onChange={(e) => set('accessibility_notes', e.target.value)} placeholder="Es. rampa all'ingresso, spogliatoio attrezzato" />
      </div>

      {hasCost ? (
        <fieldset>
          <legend className={labelClass}>Costo</legend>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(COST_LABELS) as Cost[]).map((c) => (
              <label
                key={c}
                className={`min-h-12 px-2 rounded-2xl border flex items-center justify-center text-center text-[13px] font-bold cursor-pointer ${
                  v.cost === c ? 'bg-ink text-white border-ink' : 'bg-white text-hi border-(--stroke-dark)'
                }`}
              >
                <input type="radio" name={fid('cost')} className="sr-only" checked={v.cost === c} onChange={() => set('cost', c)} />
                {c === 'da_verificare' ? 'Non indicato' : COST_LABELS[c]}
              </label>
            ))}
          </div>
          {v.cost === 'a_pagamento' && (
            <div className="mt-3">
              <label className={labelClass} htmlFor={fid('price')}>
                Prezzo
              </label>
              <input id={fid('price')} className={inputClass} maxLength={80} value={v.cost_price ?? ''} onChange={(e) => set('cost_price', e.target.value)} placeholder="Es. da 8 € l'ora" />
            </div>
          )}
          {v.cost !== 'da_verificare' && (
            <div className="mt-3">
              <label className={labelClass} htmlFor={fid('cnote')}>
                Nota sul costo (facoltativa)
              </label>
              <input id={fid('cnote')} className={inputClass} maxLength={200} value={v.cost_note ?? ''} onChange={(e) => set('cost_note', e.target.value)} placeholder="Es. gratuito per i residenti, prenotazione obbligatoria" />
            </div>
          )}
        </fieldset>
      ) : (
        <p className="text-[13px] text-mid rounded-2xl bg-amber-50 border border-amber-100 p-3">Il campo costo non è ancora attivo sul database (migrazione 031 da eseguire).</p>
      )}

      <div>
        <label className={labelClass} htmlFor={fid('hours')}>
          Orari
        </label>
        <input id={fid('hours')} className={inputClass} value={v.opening_hours ?? ''} onChange={(e) => set('opening_hours', e.target.value)} placeholder="Es. lun–ven 9–22, sab 9–18" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor={fid('phone')}>
            Telefono
          </label>
          <input id={fid('phone')} type="tel" className={inputClass} value={v.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor={fid('web')}>
            Sito
          </label>
          <input id={fid('web')} type="url" className={inputClass} value={v.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor={fid('desc')}>
          Descrizione
        </label>
        <textarea id={fid('desc')} className={`${inputClass} h-28! py-3 resize-none`} maxLength={600} value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} />
      </div>

      <p className={`min-h-5 text-[14px] font-semibold ${msg?.ok ? 'text-emerald-700' : 'text-danger'}`} role="status" aria-live="polite">
        {msg?.text}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
          Salva
        </button>
        <Link href={`/mappa?luogo=${encodeURIComponent(venue.id)}`} className={quietBtn}>
          Vedi la scheda
        </Link>
        <Link href={`/attivita/nuova?luogo=${encodeURIComponent(venue.id)}`} className={quietBtn}>
          Proponi attività
        </Link>
      </div>
    </form>
  );
}

/** Area gestore: i miei impianti (modifica dei dati operativi), le mie richieste, nuova rivendicazione. */
export function ManagerScreen() {
  const { user } = useAuth();
  const params = useSearchParams();
  const preselect = params?.get('luogo');

  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [managed, setManaged] = useState<Managed[]>([]);
  const [names, setNames] = useState<Map<string, VenueSummary>>(new Map());

  const [venue, setVenue] = useState<VenueSummary | null>(null);
  const [org, setOrg] = useState('');
  const [role, setRole] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const uid = user?.id;
  const load = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return setState('error');
    if (!uid) return;
    try {
      const [c, m, all] = await Promise.all([
        sb.from('venue_claims').select('id, venue_id, org_name, status, created_at').eq('user_id', uid).order('created_at', { ascending: false }),
        sb.from('venues').select('*').eq('verified_manager_id', uid),
        fetchVenues().catch(() => [] as VenueSummary[]),
      ]);
      if (c.error || m.error) throw new Error();
      setClaims((c.data ?? []) as Claim[]);
      setManaged((m.data ?? []) as Managed[]);
      setNames(new Map(all.map((v) => [v.id, v])));
      setState('ok');
    } catch {
      setState('error');
    }
  }, [uid]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (preselect && !venue) setVenue(names.get(preselect) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect, names]);

  const claimed = new Set(claims.map((c) => c.venue_id));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabaseBrowserClient();
    if (!sb || !uid) return;
    if (!venue) return setMsg({ ok: false, text: 'Scegli l\'impianto che gestisci.' });
    if (claimed.has(venue.id)) return setMsg({ ok: false, text: 'Hai già inviato una richiesta per questo impianto.' });
    if (org.trim().length < 2) return setMsg({ ok: false, text: 'Scrivi il nome dell\'associazione o società che gestisce l\'impianto.' });
    setBusy(true);
    setMsg(null);
    const { error } = await sb.from('venue_claims').insert({ venue_id: venue.id, user_id: uid, org_name: org.trim(), role_in_org: role.trim() || null, evidence: evidence.trim() || null });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.code === '23505' ? 'Hai già inviato una richiesta per questo impianto.' : 'Invio non riuscito. Riprova.' });
    setMsg({ ok: true, text: 'Richiesta inviata. Un amministratore la verifica: qui sotto ne vedi lo stato.' });
    setVenue(null);
    setOrg('');
    setRole('');
    setEvidence('');
    load();
  };

  return (
    <PageShell title="Area gestore" back="/profilo" backLabel="Torna al profilo">
      {state === 'loading' && (
        <div className="flex justify-center py-12" role="status">
          <Loader2 className="w-8 h-8 animate-spin text-gold-500" aria-label="Caricamento" />
        </div>
      )}
      {state === 'error' && <Notice action={<button type="button" onClick={load} className={quietBtn}>Riprova</button>}>Non riesco a caricare i tuoi impianti.</Notice>}
      {state === 'ok' && (
        <div className="space-y-6">
          {managed.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2">I tuoi impianti</h2>
              <div className="space-y-4">
                {managed.map((v) => (
                  <VenueEditor key={v.id} venue={v} onSaved={() => {}} />
                ))}
              </div>
            </section>
          )}

          {claims.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2">Le tue richieste</h2>
              <ul className="card rounded-[24px] divide-y divide-(--stroke) overflow-hidden">
                {claims.map((c) => {
                  const s = CLAIM_STATUS[c.status];
                  return (
                    <li key={c.id} className="p-4 flex items-start gap-3">
                      <s.icon className={`w-5 h-5 mt-0.5 shrink-0 ${s.tone}`} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold text-hi truncate">{names.get(c.venue_id)?.name ?? 'Impianto'}</span>
                        <span className="block text-[13px] text-mid truncate">{c.org_name}</span>
                        <span className={`block text-[13px] font-semibold ${s.tone}`}>
                          {s.label} · inviata il {new Date(c.created_at).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <h2 className="eyebrow mb-2">Rivendica un impianto</h2>
            <form onSubmit={submit} className="card rounded-[28px] p-5 space-y-4" noValidate>
              <p className="text-[14px] text-mid">
                Se gestisci un impianto puoi aggiornarne orari, contatti, costo, stato e accessibilità. Prima un amministratore verifica la richiesta.
              </p>
              <VenuePicker label="Impianto" value={venue} onChange={setVenue} filter={(v) => !v.manager_verified} />
              <div>
                <label className={labelClass} htmlFor="claim-org">
                  Associazione o società che lo gestisce
                </label>
                <input id="claim-org" className={inputClass} value={org} onChange={(e) => setOrg(e.target.value)} maxLength={120} required />
              </div>
              <div>
                <label className={labelClass} htmlFor="claim-role">
                  Il tuo ruolo (facoltativo)
                </label>
                <input id="claim-role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} placeholder="Es. presidente, responsabile dell'impianto" />
              </div>
              <div>
                <label className={labelClass} htmlFor="claim-ev">
                  Come possiamo verificarlo (facoltativo)
                </label>
                <textarea
                  id="claim-ev"
                  className={`${inputClass} h-24! py-3 resize-none`}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  maxLength={500}
                  placeholder="Es. numero della concessione, pagina del sito ufficiale. Non inserire dati personali di altre persone."
                />
              </div>
              <p className={`min-h-5 text-[14px] font-semibold ${msg?.ok ? 'text-emerald-700' : 'text-danger'}`} role="status" aria-live="polite">
                {msg?.text}
              </p>
              <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                Invia la richiesta
              </button>
            </form>
          </section>
        </div>
      )}
    </PageShell>
  );
}
