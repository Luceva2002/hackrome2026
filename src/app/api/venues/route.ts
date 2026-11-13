import { NextResponse } from 'next/server';

import { filterVenues, searchParamsToFilters } from '@/features/venues/filters';
import { listVenues } from '@/features/venues/server/repository';

export const dynamic = 'force-dynamic';

/** GET /api/venues?disciplina=basket&municipio=15&accessibile=1 — pubblico, senza login */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { venues, origin } = await listVenues();
  const filtered = filterVenues(venues, searchParamsToFilters(searchParams));
  return NextResponse.json(
    { venues: filtered, total: venues.length, origin },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' } },
  );
}
