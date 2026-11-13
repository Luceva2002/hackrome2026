/**
 * Prova della ricerca Exa su un impianto, senza scrivere nulla nel database.
 *
 *   npm run exa:venue -- "Piscina Delle Rose" "Viale America 20"
 *
 * Legge EXA_API_KEY da .env.local e stampa i campi trovati con le loro fonti
 * e la proposta che ne deriverebbe.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { findVenueFacts, toUpdateProposal } from '../../src/lib/exa/venue-facts';

const ROOT = resolve(__dirname, '../..');
for (const f of ['.env.local', '.env']) {
  const p = resolve(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const [name, address] = process.argv.slice(2);
  if (!name) {
    console.error('Uso: npm run exa:venue -- "<nome impianto>" "[indirizzo]"');
    process.exit(1);
  }
  const facts = await findVenueFacts({ name, address });
  console.log(JSON.stringify({ facts, proposal: toUpdateProposal({}, facts) }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
