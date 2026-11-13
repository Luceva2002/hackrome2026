import { NextResponse } from 'next/server';

import { requireAuth } from '@/features/auth/server/require-auth';
import { PUBLIC_COLUMNS } from '@/features/activities/server/repository';
import type { ActivityPublic, ActivityWithMe, ParticipationStatus } from '@/features/activities/types';

export const dynamic = 'force-dynamic';

/** Le mie attività: quelle che organizzo (Owner) e quelle a cui sono iscritto (Guest) */
export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;

  const [{ data: owned }, { data: joined }] = await Promise.all([
    supabase.from('activities').select('id').eq('owner_id', user.id),
    supabase.from('activity_participants').select('activity_id, status').eq('user_id', user.id),
  ]);
  const ownedIds = (owned ?? []).map((r) => r.id as string);
  const joinedMap = new Map((joined ?? []).map((r) => [r.activity_id as string, r.status as ParticipationStatus]));
  const ids = [...new Set([...ownedIds, ...joinedMap.keys()])];
  if (!ids.length) return NextResponse.json({ organizzo: [], partecipo: [] });

  // Anche le annullate: l'utente deve sapere che la sua attività è saltata
  const { data, error } = await supabase.from('activities_public').select(PUBLIC_COLUMNS).in('id', ids).order('starts_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const list = (data ?? []) as ActivityPublic[];
  const decorate = (a: ActivityPublic): ActivityWithMe => ({
    ...a,
    my_status: joinedMap.get(a.id) ?? null,
    is_owner: ownedIds.includes(a.id),
  });
  return NextResponse.json({
    organizzo: list.filter((a) => ownedIds.includes(a.id)).map(decorate),
    partecipo: list.filter((a) => joinedMap.has(a.id)).map(decorate),
  });
}
