import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth, requireAuthOrGuest } from '@/features/auth/server/require-auth';
import { filterVenues, searchParamsToFilters } from '@/features/venues/filters';
import { listVenues } from '@/features/venues/server/repository';
import type { VenueSummary } from '@/features/venues/types';
import { areaById, areaIdAt, geocode } from '@/lib/tools/places';
import { NATURE_LABELS, VENUE_KINDS } from '@/lib/sports/taxonomy';

export const dynamic = 'force-dynamic';

/** GET /api/venues?disciplina=basket&municipio=15&accessibile=1 — con login o come ospite */
export async function GET(request: Request) {
  const auth = await requireAuthOrGuest();
  if ('error' in auth) return auth.error;
  const { searchParams } = new URL(request.url);
  const { venues, origin } = await listVenues();
  const filtered = filterVenues(venues, searchParamsToFilters(searchParams));
  return NextResponse.json(
    { venues: filtered, total: venues.length, origin },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}

const reportSchema = z.object({
  name: z.string().trim().min(3).max(120),
  address: z.string().trim().max(200).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  kind: z.enum(VENUE_KINDS.map((k) => k.id) as [string, ...string[]]).default('spazio_informale'),
  nature: z.enum(Object.keys(NATURE_LABELS) as [string, ...string[]]).default('informale'),
  disciplines: z.array(z.string().min(2).max(40)).max(12).default([]),
  accessibility: z.enum(['si', 'no', 'da_verificare']).default('da_verificare'),
  opening_hours: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),
});

const REPORT_ERRORS: Record<string, string> = {
  invalid_position: 'Il punto deve essere dentro Roma.',
  rate_limit: 'Hai già segnalato molti luoghi oggi: riprova domani.',
  invalid_name: 'Il nome deve avere tra 3 e 120 caratteri.',
};

/**
 * POST /api/venues — un cittadino segnala un luogo (SPEC 4.B). Serve l'indirizzo o il punto:
 * dall'indirizzo si trovano le coordinate, dalle coordinate il Municipio. Scrive report_venue (032).
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 });
  const d = parsed.data;

  let { latitude: lat, longitude: lng } = d;
  let address = d.address;
  if (lat == null || lng == null) {
    if (!address) return NextResponse.json({ error: 'position_required', message: 'Serve l’indirizzo o la posizione del luogo.' }, { status: 400 });
    let g: Awaited<ReturnType<typeof geocode>>;
    try {
      g = await geocode(address);
    } catch (e) {
      console.error('[venues/report] geocode', e);
      return NextResponse.json({ error: 'geocode_unavailable', message: 'Il servizio delle mappe non risponde: riprova tra poco.' }, { status: 502 });
    }
    if (!g) return NextResponse.json({ error: 'address_not_found', message: `Non trovo “${address}” a Roma.` }, { status: 400 });
    [lat, lng, address] = [g.lat, g.lng, g.trovato.replace(/, \d{5} Roma.*$/, '')];
  }
  const area = areaIdAt(lng, lat);
  const municipio = area ? areaById(area)?.municipio ?? null : null;

  const { data: id, error } = await auth.supabase.rpc('report_venue', {
    p: { ...d, address, latitude: lat, longitude: lng, municipio },
  });
  if (error) {
    const code = Object.keys(REPORT_ERRORS).find((k) => error.message.includes(k));
    console.error('[venues/report]', error.message);
    return NextResponse.json({ error: code ?? 'error', message: code ? REPORT_ERRORS[code] : 'Segnalazione non riuscita, riprova.' }, { status: code ? 400 : 500 });
  }
  const venue: VenueSummary = {
    id: id as string,
    name: d.name,
    address: address ?? null,
    municipio,
    latitude: lat,
    longitude: lng,
    kind: d.kind as VenueSummary['kind'],
    nature: d.nature as VenueSummary['nature'],
    disciplines: d.disciplines,
    structures: null,
    status: 'da_verificare',
    accessibility: d.accessibility,
    community: true,
    manager_verified: false,
  };
  return NextResponse.json({ venue }, { status: 201 });
}
