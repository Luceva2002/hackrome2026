import { NextResponse } from 'next/server';

import { requireAuthOrGuest } from '@/features/auth/server/require-auth';
import { getVenue } from '@/features/venues/server/repository';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthOrGuest();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const venue = await getVenue(id);
  if (!venue) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ venue });
}
