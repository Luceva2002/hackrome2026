import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, hasSupabaseConfig } from '@/lib/supabase/config';
import type { FieldSource, VenueRecord, VenueSummary } from '../types';
import { toSummary } from '../types';

/**
 * Lettura dei luoghi. Fonte primaria: tabella `venues` su Supabase (così le
 * modifiche dei gestori sono subito visibili). Se il database non è
 * configurato o è ancora vuoto, ripiega sull'ultimo export della pipeline
 * (data/processed/venues.json): la mappa resta dimostrabile in ogni caso.
 */

const SUMMARY_COLUMNS =
  'id, name, address, municipio, latitude, longitude, kind, nature, disciplines, structures, status, accessibility, community, verified_manager_id';

let fileCache: { at: number; venues: VenueRecord[] } | null = null;

async function readProcessed(): Promise<VenueRecord[]> {
  if (fileCache && Date.now() - fileCache.at < 60_000) return fileCache.venues;
  try {
    const raw = await readFile(join(process.cwd(), 'data/processed/venues.json'), 'utf8');
    fileCache = { at: Date.now(), venues: JSON.parse(raw) as VenueRecord[] };
  } catch {
    fileCache = { at: Date.now(), venues: [] };
  }
  return fileCache.venues;
}

function publicClient() {
  if (!hasSupabaseConfig) return null;
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
}

type Row = Record<string, unknown>;

function rowToSummary(r: Row): VenueSummary {
  return {
    id: r.id as string,
    name: r.name as string,
    address: (r.address as string) ?? null,
    municipio: (r.municipio as number) ?? null,
    latitude: (r.latitude as number) ?? null,
    longitude: (r.longitude as number) ?? null,
    kind: r.kind as VenueSummary['kind'],
    nature: r.nature as VenueSummary['nature'],
    disciplines: (r.disciplines as string[]) ?? [],
    structures: (r.structures as string) ?? null,
    status: r.status as VenueSummary['status'],
    accessibility: r.accessibility as VenueSummary['accessibility'],
    community: Boolean(r.community),
    manager_verified: Boolean(r.verified_manager_id),
  };
}

export async function listVenues(): Promise<{ venues: VenueSummary[]; origin: 'database' | 'export' }> {
  const sb = publicClient();
  if (sb) {
    try {
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from('venues').select(SUMMARY_COLUMNS).range(from, from + 999);
        if (error) throw error;
        all.push(...(data as Row[]));
        if (!data || data.length < 1000) break;
      }
      if (all.length) return { venues: all.map(rowToSummary), origin: 'database' };
    } catch {
      // tabella assente o rete: si usa l'export
    }
  }
  return { venues: (await readProcessed()).map(toSummary), origin: 'export' };
}

export async function getVenue(id: string): Promise<VenueRecord | null> {
  const sb = publicClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('venues').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (data) {
        const { data: fs } = await sb.from('field_sources').select('*').eq('venue_id', id);
        const fields: VenueRecord['fields'] = {};
        for (const f of (fs ?? []) as Row[]) {
          fields[f.field as keyof VenueRecord['fields']] = {
            source: f.source_id as string,
            raw: (f.raw_value as string) ?? undefined,
            confidence: Number(f.confidence),
            note: (f.note as string) ?? undefined,
          } satisfies FieldSource;
        }
        const r = data as Row;
        return {
          ...rowToSummary(r),
          levels: (r.levels as string[]) ?? [],
          opening_hours: (r.opening_hours as string) ?? null,
          phone: (r.phone as string) ?? null,
          website: (r.website as string) ?? null,
          // colonne della migration 031: se non è ancora stata eseguita restano "da verificare"
          cost: (['gratuito', 'a_pagamento'].includes(r.cost as string) ? r.cost : 'da_verificare') as VenueRecord['cost'],
          cost_price: (r.cost_price as string) ?? null,
          cost_note: (r.cost_note as string) ?? null,
          description: (r.description as string) ?? null,
          needs_review: Boolean(r.needs_review),
          review_notes: (r.review_notes as string[]) ?? [],
          fields,
        };
      }
    } catch {
      // fallback sotto
    }
  }
  const v = (await readProcessed()).find((x) => x.id === id);
  // l'export della pipeline non ha il costo: nessuna fonte, quindi da verificare
  return v ? { ...v, cost: v.cost ?? 'da_verificare', cost_price: v.cost_price ?? null, cost_note: v.cost_note ?? null } : null;
}
