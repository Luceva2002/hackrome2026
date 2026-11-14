import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/features/auth/server/require-auth';
import { PUBLIC_COLUMNS, withMyStatus } from '@/features/activities/server/repository';
import type { ActivityPublic } from '@/features/activities/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { supabase: sb, user } = auth;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { data, error } = await sb.from('activities_public').select(PUBLIC_COLUMNS).eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const [activity] = await withMyStatus(sb, user.id, [data as ActivityPublic]);
  return NextResponse.json({ activity });
}

const patchSchema = z.object({ status: z.literal('cancelled') });

/** PATCH — l'Owner annulla la propria attività (RLS: solo owner_id = auth.uid()) */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const { data, error } = await auth.supabase
    .from('activities')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('owner_id', auth.user.id)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true });
}
