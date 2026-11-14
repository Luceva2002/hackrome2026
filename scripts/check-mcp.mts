// Prova di /api/mcp con il client MCP ufficiale (server di sviluppo acceso).
// node --env-file=.env.local --import tsx scripts/check-mcp.mts [http://localhost:3000]
/* eslint-disable @typescript-eslint/no-explicit-any -- controllo veloce su JSON */
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = new URL('/api/mcp', process.argv[2] ?? 'http://localhost:3000');
const client = new Client({ name: 'check-mcp', version: '0' });
await client.connect(
  new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${process.env.MCP_SECRET}` } } }),
);

const { tools } = await client.listTools();
console.log('strumenti:', tools.map((t) => t.name).join(', '));
assert.deepEqual(tools.map((t) => t.name).sort(), ['cerca_attivita', 'cerca_impianti', 'dettagli_attivita', 'dettagli_luogo']);
assert.ok((tools.find((t) => t.name === 'cerca_impianti')!.inputSchema.properties as any).disciplina.enum.includes('basket'));

const json = (r: any) => JSON.parse(r.content[0].text);
const a = json(await client.callTool({ name: 'cerca_attivita', arguments: { disciplina: 'yoga' } }));
console.log('yoga:', a.totale, a.risultati.map((x: any) => x.titolo).join(' | '), a.url);
assert.ok(a.totale >= 1 && a.url === '/attivita?disciplina=yoga');

const v = json(await client.callTool({ name: 'cerca_impianti', arguments: { disciplina: 'basket', municipio: 'XV' } }));
assert.ok(v.totale > 0);

const bad: any = await client.callTool({ name: 'cerca_impianti', arguments: { disciplina: 'pallacanestro' } });
assert.equal(bad.isError, true);
console.log('input sbagliato rifiutato:', bad.content[0].text.slice(0, 80));

await assert.rejects(client.callTool({ name: 'crea_attivita', arguments: {} }).then((r: any) => { if (r.isError) throw new Error('isError'); }));
await client.close();
console.log('OK');
