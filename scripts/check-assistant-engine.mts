// Motore ElevenLabs senza agente configurato o con rete instabile: deve rispondere il motore locale.
// npx tsx scripts/check-assistant-engine.mts
import assert from 'node:assert/strict';
import { createElevenLabsEngine } from '../src/features/assistant/elevenlabs-engine';
import type { AssistantMessage } from '../src/features/assistant/engine';

let status = 503;
let calls = 0;
globalThis.fetch = (async (u: string) => {
  if (!String(u).includes('/api/assistant/session')) return new Response('{}', { status: 404 }); // confini dei quartieri
  calls++;
  return new Response('{}', { status });
}) as typeof fetch;
(globalThis as { window?: unknown }).window = { location: { pathname: '/' } };

const msgs: AssistantMessage[] = [];
const urls: string[] = [];
const engine = createElevenLabsEngine({
  onStatus: () => {},
  onMessage: (m) => msgs.push(m),
  act: { navigate: (u) => urls.push(u), map: { send: () => {} } as never, locate: async () => null, count: async () => 3 },
});

// 502 (rete o ElevenLabs giù): risponde il locale, ma la volta dopo si riprova ElevenLabs
status = 502;
await engine.sendText('basket nel municipio XV');
assert.equal(msgs.filter((m) => m.role === 'user').length, 1, 'il messaggio dell’utente compare una volta sola');
assert.ok(urls[0]?.startsWith('/mappa?'), 'il motore locale ha filtrato la mappa');
await engine.sendText('piscine');
assert.equal(calls, 2, 'dopo un errore temporaneo si riprova');

// 503 (non configurato): si passa al locale per sempre, senza altre chiamate
status = 503;
await engine.sendText('tennis');
await engine.sendText('nuoto');
assert.equal(calls, 3);
assert.equal(msgs.filter((m) => m.role === 'user').length, 4);
engine.dispose();
console.log('OK');
