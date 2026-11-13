import { NextResponse } from 'next/server';

import { requireAuth } from '@/features/auth/server/require-auth';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, string> = {
  owner: 'Sei l’organizzatore di questa attività.',
  past: 'L’attività è già iniziata.',
  cancelled: 'L’attività è stata annullata.',
  not_found: 'Attività non trovata.',
};

function rpcError(message: string) {
  const code = Object.keys(MESSAGES).find((k) => message.includes(k));
  return NextResponse.json({ error: code ?? 'error', message: code ? MESSAGES[code] : message }, { status: code ? 409 : 500 });
}

/** POST → iscrizione (confermata o lista d'attesa, decide la funzione SQL atomica) */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.rpc('join_activity', { p_activity: id });
  if (error) return rpcError(error.message);
  return NextResponse.json({ status: data as 'confirmed' | 'waitlist' });
}

/** DELETE → cancellazione; se liberi un posto, il primo in attesa viene promosso */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.rpc('leave_activity', { p_activity: id });
  if (error) return rpcError(error.message);
  return NextResponse.json({ status: data as string });
}
