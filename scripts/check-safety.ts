// Controlli di sicurezza su percorsi e comandi mappa (input dell'assistente). Lancia: npx tsx scripts/check-safety.ts
import assert from 'node:assert';
import { keepSearch, safeAppPath } from '../src/lib/safe-path';
import { sanitizeMapCommand } from '../src/features/map/map-bridge';
assert.equal(safeAppPath('/mappa?disciplina=basket'), '/mappa?disciplina=basket');
for (const bad of ['//evil.com', '/\\evil.com', '/\t/evil.com', 'https://evil.com', 'javascript:alert(1)', '', null, 42])
  assert.equal(safeAppPath(bad), null, String(bad));
assert.equal(sanitizeMapCommand({ type: 'flyTo', lng: NaN, lat: 41 }), null);
assert.equal(sanitizeMapCommand({ type: 'flyTo', lng: 12, lat: 200 }), null);
assert.deepEqual(sanitizeMapCommand({ type: 'flyTo', lng: 12.5, lat: 41.9, zoom: 99, pitch: -5 }), { type: 'flyTo', lng: 12.5, lat: 41.9, zoom: 19, pitch: 0, bearing: undefined });
const t = sanitizeMapCommand({ type: 'tour', ids: Array.from({ length: 500 }, (_, i) => 'v' + i), dwellMs: -1 });
assert.ok(t && t.type === 'tour' && t.ids.length === 10 && t.dwellMs === 1500);
assert.equal(sanitizeMapCommand({ type: 'boom' } as never), null);
console.log('ok');

// Assistente: non finge di aver capito quello che non sa filtrare
import { parseLocalIntent } from '../src/features/assistant/local-intents';
assert.deepEqual(parseLocalIntent('Yoga questo weekend con posti liberi')?.ignored, ['giorni e orari', 'attività e posti liberi']);
assert.deepEqual(parseLocalIntent('piscine vicino a me')?.ignored, []);
assert.deepEqual(parseLocalIntent('piscina e tennis')?.ignored, ['più sport insieme']);
assert.equal(parseLocalIntent('Palestre accessibili nel Municipio I')?.filters.municipio, 1);
console.log('ok intents');

assert.deepEqual(sanitizeMapCommand({ type: 'zone', municipio: 3, area: 12 }), { type: 'zone', municipio: 3, area: 12 });
assert.deepEqual(sanitizeMapCommand({ type: 'zone', municipio: 99, area: 12 }), { type: 'zone', municipio: undefined, area: undefined });
console.log('ok zone');

// Aprire un luogo dalla mappa tiene la ricerca (la lista dei risultati torna alla chiusura)
assert.equal(keepSearch('/mappa?luogo=x1', '?zona=200&disciplina=basket'), '/mappa?zona=200&disciplina=basket&luogo=x1');
assert.equal(keepSearch('/mappa?luogo=x2', '?zona=200&luogo=x1'), '/mappa?zona=200&luogo=x2');
assert.equal(keepSearch('/mappa?zona=1', '?zona=200'), '/mappa?zona=1', 'una nuova ricerca sostituisce');
console.log('ok keepSearch');
