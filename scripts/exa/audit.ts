/**
 * Giro di verifica Exa su un campione di luoghi: ancora attivi? nome, orari,
 * contatti, e soprattutto costo (gratuito / a pagamento con prezzo).
 *
 *   npm run exa:audit                    # campione della demo, solo report in data/exa/
 *   npm run exa:audit -- --write         # + inserisce le proposte (pending, fonte exa_web)
 *   npm run exa:audit -- --ids a,b,c     # luoghi precisi
 *   npm run exa:audit -- --limit 40      # dimensione del campione (default 30)
 *
 * Campione: i luoghi delle attività demo, quelli con gestore, poi centri sportivi,
 * piscine e campi con posizione, finché non si arriva al limite.
 * Ogni campo proposto ha almeno un URL di fonte; niente viene scritto sulle schede.
 */
import { EXA_SOURCE_ID, findVenueFacts, toUpdateProposal } from '../../src/lib/exa/venue-facts';
import { adminDb, flag, loadEnv, option, pool, writeReport } from './lib';

type Row = { id: string; name: string; address: string | null } & Record<string, string | null>;

const COLS = 'id, name, address, status, opening_hours, phone, website, cost, cost_price, cost_note';

async function sample(db: ReturnType<typeof adminDb>, limit: number): Promise<Row[]> {
  const ids = option('ids')?.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids?.length) {
    const { data, error } = await db.from('venues').select(COLS).in('id', ids);
    if (error) throw error;
    return data as unknown as Row[];
  }
  const picked = new Set<string>();
  const { data: acts } = await db.from('activities').select('venue_id');
  for (const a of acts ?? []) if (a.venue_id) picked.add(a.venue_id as string);
  const { data: managed } = await db.from('venues').select('id').not('verified_manager_id', 'is', null);
  for (const m of managed ?? []) picked.add(m.id as string);
  const { data: more } = await db
    .from('venues')
    .select('id')
    .in('kind', ['centro_sportivo', 'piscina', 'campo'])
    .not('latitude', 'is', null)
    .eq('community', false)
    .order('name')
    .limit(limit * 3);
  for (const m of more ?? []) if (picked.size < limit) picked.add(m.id as string);
  const { data, error } = await db.from('venues').select(COLS).in('id', [...picked].slice(0, limit));
  if (error) throw error;
  return data as unknown as Row[];
}

async function main() {
  loadEnv();
  const db = adminDb();
  const write = flag('write');
  const venues = await sample(db, Number(option('limit') ?? 30));
  console.log(`[exa] verifico ${venues.length} luoghi${write ? ' e inserisco le proposte' : ' (solo report)'}`);

  let spent = 0;
  const report = await pool(venues, 3, async (v, i) => {
    try {
      const facts = await findVenueFacts({ name: v.name, address: v.address }, { deep: true });
      spent += facts.costDollars ?? 0;
      const proposal = toUpdateProposal(v, facts);
      const changed = Object.keys(proposal.payload);
      console.log(`  ${i + 1}/${venues.length} ${v.name}: ${changed.length ? changed.join(', ') : 'nessuna novità con fonte'}`);
      let proposalId: string | null = null;
      if (write && changed.length) {
        const { data, error } = await db
          .from('proposals')
          .insert({
            venue_id: v.id,
            source_id: EXA_SOURCE_ID,
            kind: 'update',
            payload: proposal.payload,
            field_sources: proposal.field_sources,
            confidence: proposal.confidence,
            reason: 'Verifica web Exa',
          })
          .select('id')
          .single();
        if (error) console.error(`    ! proposta non inserita: ${error.message}`);
        proposalId = (data?.id as string | undefined) ?? null;
      }
      return { venue: { id: v.id, name: v.name, address: v.address }, changed, proposal, proposalId, facts };
    } catch (e) {
      console.error(`  ${i + 1}/${venues.length} ${v.name}: errore ${(e as Error).message}`);
      return { venue: { id: v.id, name: v.name, address: v.address }, changed: [] as string[], error: (e as Error).message };
    }
  });

  writeReport('audit.json', { at: new Date().toISOString(), costDollars: spent, report });
  const withChanges = report.filter((r) => r.changed.length).length;
  console.log(`[exa] fatto: ${withChanges} luoghi con novità, spesa Exa ~$${spent.toFixed(2)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
