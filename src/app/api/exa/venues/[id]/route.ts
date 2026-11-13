/**
 * POST /api/exa/venues/[id] — solo admin.
 *
 * Cerca sul web orari, telefono e sito dell'impianto e, se trova valori nuovi
 * con una fonte, crea una proposta `pending` (fonte 'exa_web'). Non tocca mai
 * la scheda: la applica l'admin con `apply_proposal`.
 *
 * Risposta: { proposal: {id, payload} | null, facts }
 */
import { NextResponse } from 'next/server';

import { requireAuth } from '@/features/auth/server/require-auth';
import { getVenue } from '@/features/venues/server/repository';
import { hasExaKey } from '@/lib/exa/client';
import { EXA_SOURCE_ID, findVenueFacts, toUpdateProposal } from '@/lib/exa/venue-facts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { data: isAdmin } = await auth.supabase.rpc('is_admin');
  if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasExaKey()) return NextResponse.json({ error: 'exa_not_configured' }, { status: 503 });

  const { id } = await params;
  const venue = await getVenue(id);
  if (!venue) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let facts;
  try {
    facts = await findVenueFacts({ name: venue.name, address: venue.address });
  } catch (e) {
    console.error('[exa] ricerca impianto', id, e);
    return NextResponse.json({ error: 'exa_failed' }, { status: 502 });
  }

  const proposal = toUpdateProposal(
    { opening_hours: venue.opening_hours, phone: venue.phone, website: venue.website },
    facts,
  );
  if (!Object.keys(proposal.payload).length) return NextResponse.json({ proposal: null, facts });

  const { data, error } = await auth.supabase
    .from('proposals')
    .insert({
      venue_id: id,
      source_id: EXA_SOURCE_ID,
      kind: proposal.kind,
      payload: proposal.payload,
      field_sources: proposal.field_sources,
      confidence: proposal.confidence,
      reason: 'Ricerca web Exa',
    })
    .select('id, payload')
    .single();
  if (error) {
    console.error('[exa] insert proposal', error);
    return NextResponse.json({ error: 'proposal_failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ proposal: data, facts });
}
