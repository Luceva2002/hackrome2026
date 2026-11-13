/**
 * POST /api/exa/search { query, objective } → { results: [{title, url, site, highlights}] }
 *
 * Usato dallo strumento vocale `cerca_sul_web`. Pubblico come la voce, ma con
 * un limite per IP (in memoria, basta per la demo) perché ogni chiamata costa.
 */
import { NextResponse } from 'next/server';

import { hasExaKey } from '@/lib/exa/client';
import { webSearch, webSearchInputSchema } from '@/lib/exa/web-search';

export const dynamic = 'force-dynamic';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  if (!hasExaKey()) return NextResponse.json({ error: 'exa_not_configured' }, { status: 503 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (limited(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const parsed = webSearchInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  try {
    return NextResponse.json({ results: await webSearch(parsed.data) });
  } catch (e) {
    console.error('[exa] ricerca web', e);
    return NextResponse.json({ error: 'exa_failed' }, { status: 502 });
  }
}
