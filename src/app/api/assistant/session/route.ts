import { NextResponse } from 'next/server';

import { requireAuth } from '@/features/auth/server/require-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assistant/session → { signedUrl }
 * L'agente ElevenLabs è privato: solo chi ha fatto login riceve un URL firmato
 * (vale 15 minuti per aprire la conversazione). La chiave resta sul server.
 */
export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const key = process.env.ELEVENLABS_API_KEY;
  const agent = process.env.ELEVENLABS_AGENT_ID;
  if (!key || !agent) return NextResponse.json({ error: 'assistant_not_configured' }, { status: 503 });

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent)}`,
      { headers: { 'xi-api-key': key }, cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
    const { signed_url } = (await r.json()) as { signed_url?: string };
    if (!signed_url) throw new Error('ElevenLabs: signed_url mancante');
    return NextResponse.json({ signedUrl: signed_url });
  } catch (e) {
    console.error('[assistant/session]', e);
    return NextResponse.json({ error: 'assistant_unavailable' }, { status: 502 });
  }
}
