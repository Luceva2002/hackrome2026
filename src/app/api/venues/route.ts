import { NextResponse } from 'next/server';

import { requireAuth } from '@/features/auth/server/require-auth';
import { filterVenues, searchParamsToFilters } from '@/features/venues/filters';
import { listVenues } from '@/features/venues/server/repository';

export const dynamic = 'force-dynamic';

/** GET /api/venues?disciplina=basket&municipio=15&accessibile=1 — solo con login */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { searchParams } = new URL(request.url);
  const { venues, origin } = await listVenues();
  const filtered = filterVenues(venues, searchParamsToFilters(searchParams));
  return NextResponse.json(
    { venues: filtered, total: venues.length, origin },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
