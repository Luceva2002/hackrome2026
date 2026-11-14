'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { Notice, PageShell, quietBtn } from '@/components/layout/PageShell';
import { fetchVenues } from '@/features/venues/hooks/use-venues';
import type { UserProfile } from '@/features/profile/types';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Claim {
  id: string;
  venue_id: string;
  org_name: string;
  role_in_org: string | null;
  evidence: string | null;
  created_at: string;
}
interface Proposal {
  id: string;
  venue_id: string | null;
  source_id: string;
  kind: 'create' | 'update';
  payload: Record<string, unknown>;
  field_sources: Record<string, { raw?: string; confidence?: number; note?: string }> | null;
  confidence: number;
  created_at: string;
}
interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  license: string | null;
  last_checked_at: string | null;
  last_status: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome', address: 'Indirizzo', municipio: 'Municipio', latitude: 'Latitudine', longitude: 'Longitudine', kind: 'Tipo',
  nature: 'Natura', disciplines: 'Sport', structures: 'Strutture', levels: 'Livelli', status: 'Stato', accessibility: 'Accessibilità',
  opening_hours: 'Orari', phone: 'Telefono', website: 'Sito', cost: 'Costo', cost_price: 'Prezzo', cost_note: 'Nota sul costo',
  operator_org: 'Concessionario', concession_expires_on: 'Scadenza concessione', school_building_code: 'Codice edificio',
};
const show = (v: unknown) => (v == null || v === '' ? 'vuoto' : Array.isArray(v) ? v.join(', ') || 'vuoto' : String(v));
const day = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });
const httpUrl = (s: string | undefined | null) => (s && /^https?:\/\//i.test(s) ? s : null);

const TABS = [
  { id: 'claims', label: 'Rivendicazioni' },
  { id: 'proposals', label: 'Proposte' },
  { id: 'sources', label: 'Fonti' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** Pannello admin: rivendicazioni dei gestori, proposte di modifica delle fonti, elenco delle fonti. */
export function AdminScreen() {
  const [role, setRole] = useState<UserProfile['role'] | 'loading' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('claims');
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalCount, setProposalCount] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p: UserProfile) => setRole(p.role))
      .catch(() => setRole('error'));
  }, []);

  const load = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return setState('error');
    try {
      const [c, p, s, all] = await Promise.all([
        sb.from('venue_claims').select('id, venue_id, org_name, role_in_org, evidence, created_at').eq('status', 'pending').order('created_at'),
        sb.from('proposals').select('id, venue_id, source_id, kind, payload, field_sources, confidence, created_at', { count: 'exact' }).eq('status', 'pending').order('created_at', { ascending: false }).limit(30),
        sb.from('sources').select('id, title, publisher, url, license, last_checked_at, last_status').order('priority'),
        fetchVenues().catch(() => []),
      ]);
      if (c.error || p.error || s.error) throw new Error();
      setClaims((c.data ?? []) as Claim[]);
      setProposals((p.data ?? []) as Proposal[]);
      setProposalCount(p.count ?? p.data?.length ?? 0);
      setSources((s.data ?? []) as Source[]);
      setNames(new Map(all.map((v) => [v.id, v.name])));
      setState('ok');
    } catch {
      setState('error');
    }
  }, []);
  useEffect(() => {
    if (role === 'admin') load();
  }, [role, load]);

  const run = async (id: string, what: () => PromiseLike<{ error: { message: string } | null }>, done: string) => {
    setBusy(id);
    setMsg(null);
    const { error } = await what();
    setBusy(null);
    if (error) {
      setMsg(
        /column .*cost/i.test(error.message)
          ? 'Questa proposta contiene il costo, ma la migrazione 031 non è ancora stata eseguita sul database.'
          : 'Operazione non riuscita. Riprova.',
      );
      return;
    }
    setMsg(done);
    load();
  };

  const shell = (children: React.ReactNode) => (
    <PageShell title="Pannello admin" back="/profilo" backLabel="Torna al profilo">
      {children}
    </PageShell>
  );
  const spinner = (
    <div className="flex justify-center py-12" role="status">
      <Loader2 className="w-8 h-8 animate-spin text-gold-500" aria-label="Caricamento" />
    </div>
  );
  if (role === 'loading') return shell(spinner);
  if (role !== 'admin')
    return shell(
      <Notice action={<Link href="/profilo" className={quietBtn}>Torna al profilo</Link>}>
        {role === 'error' ? 'Non riesco a verificare il tuo ruolo.' : 'Questa pagina è riservata agli amministratori.'}
      </Notice>,
    );

  const sb = getSupabaseBrowserClient()!;
  const counts: Record<Tab, number> = { claims: claims.length, proposals: proposalCount, sources: sources.length };

  return shell(
    <>
      <div role="tablist" aria-label="Sezioni" className="card rounded-full p-1 grid grid-cols-3 mb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`h-10 rounded-full text-[13px] font-bold ${tab === t.id ? 'bg-ink text-white' : 'text-hi'}`}
          >
            {t.label}
            {state === 'ok' && <span className="font-normal"> · {counts[t.id]}</span>}
          </button>
        ))}
      </div>
      <p className="min-h-6 text-[14px] font-semibold text-hi mb-2" role="status" aria-live="polite">
        {msg}
      </p>

      {state === 'loading' && spinner}
      {state === 'error' && <Notice action={<button type="button" onClick={load} className={quietBtn}>Riprova</button>}>Non riesco a caricare i dati.</Notice>}

      {state === 'ok' && tab === 'claims' && (
        claims.length === 0 ? (
          <Notice>Nessuna rivendicazione in attesa.</Notice>
        ) : (
          <ul className="space-y-3">
            {claims.map((c) => (
              <li key={c.id} className="card rounded-[24px] p-4">
                <Link href={`/mappa?luogo=${encodeURIComponent(c.venue_id)}`} className="text-[15px] font-bold text-hi underline">
                  {names.get(c.venue_id) ?? c.venue_id}
                </Link>
                <p className="text-[14px] text-hi mt-1">
                  {c.org_name}
                  {c.role_in_org && <span className="text-mid"> · {c.role_in_org}</span>}
                </p>
                {c.evidence && <p className="text-[13px] text-mid mt-1 whitespace-pre-line break-words">{c.evidence}</p>}
                <p className="text-[12px] text-low mt-1">Inviata il {day(c.created_at)}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" disabled={busy === c.id} className={quietBtn} onClick={() => run(c.id, () => sb.rpc('review_claim', { p_claim: c.id, p_approve: false }), 'Rivendicazione respinta.')}>
                    Respingi
                  </button>
                  <button
                    type="button"
                    disabled={busy === c.id}
                    className={`${quietBtn} bg-ink! text-white!`}
                    onClick={() => run(c.id, () => sb.rpc('review_claim', { p_claim: c.id, p_approve: true }), 'Rivendicazione approvata: ora è il gestore verificato.')}
                  >
                    Approva
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {state === 'ok' && tab === 'proposals' && (
        proposals.length === 0 ? (
          <Notice>Nessuna proposta in attesa.</Notice>
        ) : (
          <>
            {proposalCount > proposals.length && <p className="text-[13px] text-mid mb-2">Le {proposals.length} più recenti su {proposalCount} in attesa.</p>}
            <ul className="space-y-3">
              {proposals.map((p) => {
                const fields = p.kind === 'update' ? Object.entries(p.payload as Record<string, { old?: unknown; new?: unknown }>) : [];
                const title = p.kind === 'create' ? `Nuovo luogo: ${show(p.payload.name)}` : (names.get(p.venue_id ?? '') ?? p.venue_id ?? 'Luogo');
                return (
                  <li key={p.id} className="card rounded-[24px] p-4">
                    <p className="text-[15px] font-bold text-hi">{title}</p>
                    <p className="text-[12px] text-low">
                      Fonte: {p.source_id} · affidabilità {Math.round(p.confidence * 100)}% · {day(p.created_at)}
                    </p>
                    {p.kind === 'create' ? (
                      <dl className="mt-2 text-[13px] space-y-1">
                        {Object.entries(p.payload)
                          .filter(([k, v]) => FIELD_LABELS[k] && v != null && v !== '')
                          .map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <dt className="text-mid shrink-0">{FIELD_LABELS[k]}:</dt>
                              <dd className="text-hi break-words min-w-0">{show(v)}</dd>
                            </div>
                          ))}
                      </dl>
                    ) : (
                      <ul className="mt-2 text-[13px] space-y-1.5">
                        {fields.map(([k, v]) => (
                          <li key={k}>
                            <span className="font-bold text-hi">{FIELD_LABELS[k] ?? k}: </span>
                            <span className="text-mid line-through break-words">{show(v?.old)}</span>
                            <span className="text-hi break-words"> → {show(v?.new)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {p.field_sources && (
                      <ul className="mt-2 text-[12px] text-mid space-y-0.5">
                        {Object.entries(p.field_sources)
                          .filter(([, fs]) => fs?.note || fs?.raw)
                          .slice(0, 4)
                          .map(([k, fs]) => (
                            <li key={k} className="break-words">
                              {FIELD_LABELS[k] ?? k}: {fs.raw && <>“{fs.raw}” </>}
                              {httpUrl(fs.note) ? (
                                <a href={httpUrl(fs.note)!} target="_blank" rel="noopener noreferrer" className="underline">
                                  pagina di origine
                                </a>
                              ) : (
                                fs.note
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={busy === p.id}
                        className={quietBtn}
                        onClick={() => run(p.id, () => sb.from('proposals').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', p.id), 'Proposta respinta.')}
                      >
                        Respingi
                      </button>
                      <button
                        type="button"
                        disabled={busy === p.id}
                        className={`${quietBtn} bg-ink! text-white!`}
                        onClick={() => run(p.id, () => sb.rpc('apply_proposal', { p_proposal: p.id }), 'Proposta applicata alla scheda, con la sua fonte.')}
                      >
                        Applica
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )
      )}

      {state === 'ok' && tab === 'sources' && (
        sources.length === 0 ? (
          <Notice>Nessuna fonte registrata.</Notice>
        ) : (
          <ul className="card rounded-[24px] divide-y divide-(--stroke) overflow-hidden">
            {sources.map((s) => (
              <li key={s.id} className="p-4">
                <p className="text-[15px] font-bold text-hi">{s.title}</p>
                <p className="text-[13px] text-mid">
                  {s.publisher}
                  {s.license && ` · licenza ${s.license}`}
                </p>
                <p className="text-[12px] text-low mt-0.5">
                  {s.last_checked_at ? `Ultimo controllo il ${day(s.last_checked_at)}${s.last_status ? ` · ${s.last_status}` : ''}` : 'Mai controllata dalla pipeline'}
                </p>
                {httpUrl(s.url) && (
                  <a href={httpUrl(s.url)!} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold underline break-all">
                    Apri la fonte
                  </a>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </>,
  );
}
