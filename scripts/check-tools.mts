// Controllo degli strumenti di lettura sui dati veri di Supabase.
// node --env-file=.env.local --conditions=react-server --import tsx scripts/check-tools.mts
import assert from 'node:assert/strict';
/* eslint-disable @typescript-eslint/no-explicit-any -- controllo veloce su JSON degli strumenti */
import { createClient } from '@supabase/supabase-js';
import { READ_TOOLS } from '@/lib/tools/read';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
const t = Object.fromEntries(READ_TOOLS.map((x) => [x.name, x]));
const call = (n: string, raw: unknown) => t[n].run(t[n].input.parse(raw), { sb }) as Promise<any>;

const v = await call('cerca_impianti', { disciplina: 'basket', municipio: 'XV', accessibile: true });
console.log('impianti basket XV accessibili:', v.totale, v.url, v.risultati[0]?.nome);
assert.match(v.url, /^\/mappa\?disciplina=basket&municipio=15&accessibile=1$/);
const all = await call('cerca_impianti', {});
assert.ok(all.totale > 1000 && all.risultati.length === 8);
const near = await call('cerca_impianti', { vicino: { lat: 41.89, lng: 12.49, km: 2 } });
assert.ok(near.risultati.every((r: any, i: number, a: any[]) => i === 0 || a[i - 1].distanza_km <= r.distanza_km));
assert.throws(() => t.cerca_impianti.input.parse({ disciplina: 'pallacanestro' }));

const c = await call('cerca_impianti', { tipo: 'spazio_informale' });
assert.ok(c.totale >= 5 && c.risultati.every((r: any) => r.segnalato_dalla_community));

const d = await call('dettagli_luogo', { id: all.risultati[0].id });
console.log('dettaglio:', d.nome, d.url, Object.keys(d.fonti).length, 'fonti');
assert.equal((await call('dettagli_luogo', { id: 'non-esiste' })).errore, 'Luogo non trovato');

const a = await call('cerca_attivita', {});
console.log('attività future:', a.totale, a.risultati[0]?.titolo, a.risultati[0]?.quando);
const w = await call('cerca_attivita', { quando: 'weekend', posti_liberi: true, disciplina: 'yoga' });
assert.equal(w.url, '/attivita?quando=weekend&disciplina=yoga&posti_liberi=1');
if (a.risultati[0]) {
  const da = await call('dettagli_attivita', { id: a.risultati[0].id });
  assert.equal(da.url, `/attivita/${a.risultati[0].id}`);
}
assert.equal((await call('dettagli_attivita', { id: '00000000-0000-0000-0000-000000000000' })).errore, 'Attività non trovata');
// Quartieri e testo detti a voce (conversazioni vere del 14/11)
const zona = async (raw: unknown) => ((await call('cerca_impianti', raw)).quartieri ?? []).map((x: string) => x.split(' (')[0]);
for (const said of ['Torrevecchia', 'Torre vecchia', 'torra vecia', 'zona torrevecchia']) {
  assert.deepEqual((await zona({ zona: said })).sort(), ['Torrevecchia Alta', 'Torrevecchia Bassa'], said);
}
assert.deepEqual(await zona({ q: 'Torre Vecchia' }), ['Torrevecchia Bassa', 'Torrevecchia Alta'], 'q che è un quartiere diventa zona');
assert.deepEqual(await zona({ zona: 'garbatela' }), ['Garbatella']);
assert.deepEqual(await zona({ zona: 'Monti' }), ['Monti'], 'nome esatto: solo il rione');
assert.deepEqual(await zona({ zona: 'Prati' }), ['Prati']);
assert.equal((await zona({ q: 'aniene' })).length, 0, 'Aniene è anche un circolo: resta testo');
const g = await call('cerca_impianti', { zona: 'Garbatella' });
assert.ok(g.totale > 3 && g.url === '/mappa?zona=200', g.url);
const unknown = await call('cerca_impianti', { zona: 'xyzzyq' });
assert.equal(unknown.totale, 0);
assert.ok(unknown.note.length);
const cassia = await call('cerca_impianti', { q: 'circolo sportivo sulla cassia' });
assert.equal(cassia.totale, 0, 'niente risultati a caso su più parole');
assert.match(cassia.note.join(' '), /indirizzo/);
const addr = await call('cerca_impianti', { indirizzo: 'piazza Francesco Zambeccari 3' });
assert.ok(addr.totale > 0 && addr.url.startsWith('/mappa?vicino=41.87'), addr.url);
assert.ok(addr.risultati.every((r: any) => r.distanza_km <= 1));
const typo = await call('cerca_impianti', { q: 'aquanienne' });
assert.ok(typo.risultati.some((r: any) => /aquaniene/i.test(r.nome)) && typo.note, 'errore di battitura su un nome');
const caff = await call('dettagli_luogo', { id: 'demo-community-caffarella' });
assert.ok(caff.costo && caff.quartiere && caff.attivita_in_programma.length >= 1, 'scheda con costo, quartiere e attività');
console.log('OK');
