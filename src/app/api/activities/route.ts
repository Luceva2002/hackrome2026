import { NextResponse } from 'next/server';

import { requireAuth } from '@/features/auth/server/require-auth';
import { createActivitySchema, filterActivities, paramsToActivityFilters } from '@/features/activities/filters';
import { listUpcoming, withMyStatus } from '@/features/activities/server/repository';
import { getVenue } from '@/features/venues/server/repository';
import { getSupabaseRouteClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/activities?quando=weekend&disciplina=yoga&posti_liberi=1 — pubblico */
export async function GET(request: Request) {
  const sb = await getSupabaseRouteClient();
  if (!sb) return NextResponse.json({ error: 'database_not_configured' }, { status: 503 });
  try {
    const { searchParams } = new URL(request.url);
    const filters = paramsToActivityFilters(searchParams);
    const list = filterActivities(await listUpcoming(sb), filters);
    const {
      data: { user },
    } = await sb.auth.getUser();
    return NextResponse.json({ activities: await withMyStatus(sb, user?.id ?? null, list) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST /api/activities — crea un'attività; chi la crea ne diventa Owner */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user, supabase } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = createActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 });
  }
  const venue = await getVenue(parsed.data.venue_id);
  if (!venue) return NextResponse.json({ error: 'venue_not_found' }, { status: 400 });

  const { data, error } = await supabase
    .from('activities')
    .insert({
      ...parsed.data,
      owner_id: user.id,
      accessible: parsed.data.accessible || venue.accessibility === 'si',
      latitude: venue.latitude,
      longitude: venue.longitude,
      municipio: venue.municipio,
      place_label: venue.name,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
