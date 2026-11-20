import 'server-only';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSupabaseRouteClient } from '@/lib/supabase/server';

/** Uguale a GUEST_COOKIE in features/auth/guest.ts (che è un modulo client) */
const GUEST_COOKIE = 'sic_ospite';

export async function requireAuth() {
  const supabase = await getSupabaseRouteClient();
  if (!supabase) {
    return {
      error: NextResponse.json({ error: 'Supabase not configured' }, { status: 500 }),
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  // Ospite (login anonimo): solo letture pubbliche, vedi requireAuthOrGuest
  if (user.is_anonymous) {
    return {
      error: NextResponse.json({ error: 'account_required', message: 'Serve un account: accedi o registrati.' }, { status: 403 }),
    };
  }

  return { user, supabase };
}

/**
 * Letture pubbliche (luoghi): con login, oppure in modalità ospite (cookie scelto al login).
 * I dati dei luoghi vengono comunque dal client pubblico, non dalla sessione.
 */
export async function requireAuthOrGuest() {
  const jar = await cookies();
  if (jar.get(GUEST_COOKIE)?.value === '1') return { guest: true as const };
  const supabase = await getSupabaseRouteClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (data.user?.is_anonymous) return { guest: true as const };
  return requireAuth();
}
