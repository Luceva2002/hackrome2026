import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ActivityPublic, ActivityWithMe, ParticipationStatus } from '../types';

export const PUBLIC_COLUMNS =
  'id, venue_id, venue_name, title, description, discipline, level, starts_at, ends_at, capacity, confirmed_count, waitlist_count, spots_left, accessible, price_note, status, latitude, longitude, municipio, place_label, is_demo, owner_name, owner_is_venue_manager';

export async function listUpcoming(sb: SupabaseClient, limit = 300): Promise<ActivityPublic[]> {
  const { data, error } = await sb
    .from('activities_public')
    .select(PUBLIC_COLUMNS)
    .eq('status', 'published')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityPublic[];
}

export async function withMyStatus(
  sb: SupabaseClient,
  userId: string | null,
  list: ActivityPublic[],
): Promise<ActivityWithMe[]> {
  if (!userId || !list.length) return list.map((a) => ({ ...a, my_status: null, is_owner: false }));
  const ids = list.map((a) => a.id);
  const [{ data: mine }, { data: owned }] = await Promise.all([
    sb.from('activity_participants').select('activity_id, status').in('activity_id', ids),
    sb.from('activities').select('id').eq('owner_id', userId).in('id', ids),
  ]);
  const status = new Map((mine ?? []).map((r) => [r.activity_id as string, r.status as ParticipationStatus]));
  const own = new Set((owned ?? []).map((r) => r.id as string));
  return list.map((a) => ({ ...a, my_status: status.get(a.id) ?? null, is_owner: own.has(a.id) }));
}
