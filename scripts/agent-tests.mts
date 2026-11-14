// Test dell'agente ElevenLabs: un turno ciascuno, si controlla quale strumento chiama e con quali parametri.
// Costano pochi crediti (solo LLM, niente voce). Si lanciano per priorità:
//   node --env-file=.env.local --import tsx scripts/agent-tests.mts 1        → priorità 1 (=2: solo la 2)
//   node --env-file=.env.local --import tsx scripts/agent-tests.mts 2 zona   → priorità ≤ 2 col nome che contiene "zona"
// I test si creano o aggiornano per nome (prefisso "sic:"), quindi rilanciare non li duplica.
const KEY = process.env.ELEVENLABS_API_KEY!;
const AGENT = process.env.ELEVENLABS_AGENT_ID!;
const MCP = 'SportInComune';
if (!KEY || !AGENT) throw new Error('Servono ELEVENLABS_API_KEY e ELEVENLABS_AGENT_ID');

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`https://api.elevenlabs.io${path}`, {
    method,
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}\n${text.slice(0, 800)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

type Eval = { type: 'exact'; expected_value: string } | { type: 'regex'; pattern: string } | { type: 'llm'; description: string } | { type: 'anything' };
type Turn = { role: 'user' | 'agent'; message?: string; tool_calls?: { tool: string; params: object }[]; tool_results?: { tool: string; result: unknown }[] };
interface Case {
  name: string;
  prio: number;
  say: string;
  history?: Turn[];
  tool: string;
  params?: Record<string, Eval>;
}

const re = (pattern: string): Eval => ({ type: 'regex', pattern });
const exact = (v: string): Eval => ({ type: 'exact', expected_value: v });
const GARBATELLA = {
  totale: 2,
  quartieri: ['Garbatella (Municipio VIII)'],
  risultati: [
    { id: 'cmrc-aaa', nome: 'Palestra Alonzi', indirizzo: 'Via Alonzi 1', url: '/mappa?luogo=cmrc-aaa' },
    { id: 'cmrc-bbb', nome: 'Campo Battisti', indirizzo: 'Via Battisti 2', url: '/mappa?luogo=cmrc-bbb' },
  ],
  url: '/mappa?zona=200',
};

const MINIBASKET = {
  totale: 1,
  risultati: [{ id: 'cddba25e-f24a-4f4d-baa0-90444d7be67d', titolo: 'Minibasket per bambini 8–11 anni', quando: 'Sabato 21 novembre, 10:00–11:00', luogo: 'Circolo Magistrati Corte dei Conti', posti_liberi: 16, url: '/attivita/cddba25e-f24a-4f4d-baa0-90444d7be67d' }],
  url: '/attivita?disciplina=basket',
};

// Priorità 1: il flusso base "impianti in zona" e le ricerche che fallivano nelle conversazioni vere
const CASES: Case[] = [
  { name: 'zona: torre vecchia', prio: 1, say: 'mi fai vedere gli impianti di torre vecchia', tool: 'cerca_impianti', params: { zona: re('(?i)torr[ae] ?vecc?h?ia') } },
  { name: 'zona: garbatela storpiato', prio: 1, say: 'che impianti sportivi ci sono a garbatela', tool: 'cerca_impianti', params: { zona: re('(?i)garbatell?a') } },
  { name: 'indirizzo: sulla cassia', prio: 1, say: 'bro mi cerchi un circolo sportivo sulla cassia', tool: 'cerca_impianti', params: { indirizzo: re('(?i)cassia') } },
  { name: 'posizione: in zona', prio: 1, say: 'hey mi dici gli impianti sportivi in zona?', tool: 'posizione' },
  {
    name: 'posizione → zona del quartiere',
    prio: 1,
    say: 'quali impianti ci sono qui vicino?',
    history: [
      { role: 'user', message: 'quali impianti ci sono qui vicino?' },
      { role: 'agent', tool_calls: [{ tool: 'posizione', params: {} }] },
      { role: 'agent', tool_results: [{ tool: 'posizione', result: { lat: 41.9466, lng: 12.4302, quartiere: 'Torrevecchia Alta', municipio: 14 } }] },
    ],
    tool: 'cerca_impianti',
    params: { zona: re('(?i)torrevecchia') },
  },
  {
    name: 'dopo la ricerca: naviga',
    prio: 1,
    say: 'impianti a Garbatella',
    history: [
      { role: 'user', message: 'impianti a Garbatella' },
      { role: 'agent', tool_calls: [{ tool: 'cerca_impianti', params: { zona: 'Garbatella' } }] },
      { role: 'agent', tool_results: [{ tool: 'cerca_impianti', result: GARBATELLA }] },
    ],
    tool: 'naviga',
    params: { url: exact('/mappa?zona=200') },
  },
  {
    name: 'info su quell’impianto',
    prio: 1,
    say: 'mi dai informazioni sul secondo?',
    history: [
      { role: 'user', message: 'impianti a Garbatella' },
      { role: 'agent', tool_calls: [{ tool: 'cerca_impianti', params: { zona: 'Garbatella' } }] },
      { role: 'agent', tool_results: [{ tool: 'cerca_impianti', result: GARBATELLA }] },
      { role: 'agent', message: 'Nel quartiere Garbatella ho trovato due luoghi: Palestra Alonzi e Campo Battisti. Vuoi i dettagli di uno?' },
    ],
    tool: 'dettagli_luogo',
    params: { id: exact('cmrc-bbb') },
  },
  {
    name: 'lista: il prossimo',
    prio: 1,
    say: 'il prossimo',
    history: [
      { role: 'user', message: 'impianti a Garbatella' },
      { role: 'agent', tool_calls: [{ tool: 'cerca_impianti', params: { zona: 'Garbatella' } }] },
      { role: 'agent', tool_results: [{ tool: 'cerca_impianti', result: GARBATELLA }] },
      { role: 'agent', message: 'Nel quartiere Garbatella ho trovato due luoghi. Il primo è Palestra Alonzi in via Alonzi. Vuoi sentire il prossimo?' },
    ],
    tool: 'naviga',
    params: { url: exact('/mappa?luogo=cmrc-bbb') },
  },
  // Scritture: lo strumento si chiama subito (mostra il pulsante), il sì arriva dopo con confermato true
  {
    name: 'iscrizione: chiama subito dopo la ricerca',
    prio: 1,
    say: 'iscrivimi al minibasket per bambini di sabato 21',
    history: [
      { role: 'user', message: 'iscrivimi al minibasket per bambini di sabato 21' },
      { role: 'agent', tool_calls: [{ tool: 'cerca_attivita', params: { giorno: '2026-11-21', q: 'minibasket' } }] },
      { role: 'agent', tool_results: [{ tool: 'cerca_attivita', result: MINIBASKET }] },
      { role: 'agent', tool_calls: [{ tool: 'naviga', params: { url: '/attivita/cddba25e-f24a-4f4d-baa0-90444d7be67d' } }] },
      { role: 'agent', tool_results: [{ tool: 'naviga', result: 'ok' }] },
    ],
    tool: 'iscriviti_attivita',
    params: { id: exact('cddba25e-f24a-4f4d-baa0-90444d7be67d') },
  },
  {
    name: 'iscrizione: sì → confermato',
    prio: 1,
    say: 'sì',
    history: [
      { role: 'user', message: 'iscrivimi al minibasket' },
      { role: 'agent', tool_calls: [{ tool: 'iscriviti_attivita', params: { id: 'cddba25e-f24a-4f4d-baa0-90444d7be67d' } }] },
      {
        role: 'agent',
        tool_results: [
          {
            tool: 'iscriviti_attivita',
            result:
              'IN ATTESA DI CONFERMA, non è ancora stato fatto nulla. Di\' all\'utente: "Ti iscrivo a «Minibasket per bambini 8–11 anni», Sabato 21 novembre, 10:00–11:00. Confermi?" Se dice sì, richiama questo strumento con gli stessi parametri e confermato true.',
          },
        ],
      },
      { role: 'agent', message: 'Ti iscrivo a Minibasket per bambini, sabato 21 novembre dalle dieci alle undici. Confermi?' },
    ],
    tool: 'iscriviti_attivita',
    params: { id: exact('cddba25e-f24a-4f4d-baa0-90444d7be67d'), confermato: exact('true') },
  },
  {
    name: 'attività: giorno preciso',
    prio: 1,
    say: 'che attività ci sono sabato 21?',
    tool: 'cerca_attivita',
    params: { giorno: exact('2026-11-21') },
  },
  // Priorità 2: filtri combinati e lingua
  { name: 'filtri: piscine municipio 12', prio: 2, say: 'piscine nel municipio dodici', tool: 'cerca_impianti', params: { tipo: exact('piscina'), municipio: re('^(12|XII)$') } },
  { name: 'indirizzo + sport', prio: 2, say: 'campi da basket vicino a piazza Zambeccari 3', tool: 'cerca_impianti', params: { indirizzo: re('(?i)zambeccari'), disciplina: exact('basket') } },
  { name: 'inglese: trastevere', prio: 2, say: 'are there basketball courts in Trastevere?', tool: 'cerca_impianti', params: { zona: re('(?i)trastevere'), disciplina: exact('basket') } },
  { name: 'attività: prossimi giorni', prio: 2, say: 'ci sono corsi di yoga nei prossimi giorni?', tool: 'cerca_attivita', params: { quando: exact('settimana'), disciplina: exact('yoga') } },
  { name: 'nome impianto in q', prio: 2, say: 'dov’è il circolo canottieri aniene?', tool: 'cerca_impianti', params: { q: re('(?i)aniene') } },
  // Priorità 3: pagine dell'app, altri filtri, gestione delle proprie attività
  { name: 'pagina: bacheca attività', prio: 3, say: 'portami alla pagina delle attività', tool: 'naviga', params: { url: re('^/attivita') } },
  { name: 'pagina: home', prio: 3, say: 'torna alla pagina iniziale', tool: 'naviga', params: { url: exact('/inizio') } },
  { name: 'le mie attività', prio: 3, say: 'a cosa sono iscritto?', tool: 'le_mie_attivita' },
  {
    name: 'bacheca filtrata a voce',
    prio: 3,
    say: 'portami alla pagina attività e cercami yoga questo weekend con posti liberi',
    tool: 'cerca_attivita',
    params: { quando: exact('weekend'), disciplina: exact('yoga'), posti_liberi: re('(?i)^true$') },
  },
  {
    name: 'iscrivimi alla prima',
    prio: 3,
    say: 'iscrivimi alla prima',
    history: [
      { role: 'user', message: 'yoga questo weekend' },
      { role: 'agent', tool_calls: [{ tool: 'cerca_attivita', params: { quando: 'weekend', disciplina: 'yoga' } }] },
      {
        role: 'agent',
        tool_results: [
          {
            tool: 'cerca_attivita',
            result: {
              totale: 2,
              risultati: [
                { id: '11111111-1111-4111-8111-111111111111', titolo: 'Yoga al tramonto', quando: 'Domani, 17:30–18:30', posti_liberi: 8, url: '/attivita/11111111-1111-4111-8111-111111111111' },
                { id: '22222222-2222-4222-8222-222222222222', titolo: 'Yoga dolce', quando: 'Sabato 21 novembre, 09:30', posti_liberi: 5, url: '/attivita/22222222-2222-4222-8222-222222222222' },
              ],
              url: '/attivita?quando=weekend&disciplina=yoga',
            },
          },
        ],
      },
      { role: 'agent', message: 'Ho trovato due attività di yoga: Yoga al tramonto domani alle diciassette e trenta, e Yoga dolce sabato 21 alle nove e mezza.' },
    ],
    tool: 'iscriviti_attivita',
    params: { id: exact('11111111-1111-4111-8111-111111111111') },
  },
  { name: 'filtri: palestre pubbliche', prio: 3, say: 'palestre pubbliche nel municipio due', tool: 'cerca_impianti', params: { natura: exact('pubblico'), tipo: exact('palestra'), municipio: re('^(2|II)$') } },
  { name: 'filtri: palestre delle scuole', prio: 3, say: 'palestre delle scuole a Centocelle', tool: 'cerca_impianti', params: { tipo: exact('palestra_scolastica'), zona: re('(?i)centocelle') } },
  { name: 'mappa: tutta Roma', prio: 3, say: 'fammi vedere tutta Roma dall’alto', tool: 'mappa', params: { azione: exact('panoramica') } },
  {
    name: 'annulla la mia attività',
    prio: 3,
    say: 'annulla la mia partita di sabato',
    history: [
      { role: 'user', message: 'annulla la mia partita di sabato' },
      { role: 'agent', tool_calls: [{ tool: 'le_mie_attivita', params: {} }] },
      {
        role: 'agent',
        tool_results: [
          {
            tool: 'le_mie_attivita',
            result: {
              organizzo: [{ id: '33333333-3333-4333-8333-333333333333', titolo: 'Calcetto del sabato', quando: 'Sabato 21 novembre, 18:00–19:30', stato: 'organizzata da te', url: '/attivita/33333333-3333-4333-8333-333333333333' }],
              partecipo: [],
            },
          },
        ],
      },
    ],
    tool: 'annulla_attivita',
    params: { id: exact('33333333-3333-4333-8333-333333333333') },
  },
  {
    name: 'raggio: entro 5 km da me',
    prio: 3,
    say: 'campi da tennis entro 5 km da me',
    history: [
      { role: 'user', message: 'campi da tennis entro 5 km da me' },
      { role: 'agent', tool_calls: [{ tool: 'posizione', params: {} }] },
      { role: 'agent', tool_results: [{ tool: 'posizione', result: { lat: 41.87, lng: 12.5, quartiere: 'Garbatella', municipio: 8 } }] },
    ],
    tool: 'cerca_impianti',
    params: { disciplina: exact('tennis'), vicino: { type: 'llm', description: 'Oggetto con lat e lng della posizione e km uguale a 5' } },
  },
  {
    name: 'segnala: dopo aver controllato che manca',
    prio: 3,
    say: 'in via del Porto Fluviale 5 c’è un campetto da basket libero che non trovo, aggiungilo: si chiama Playground Porto Fluviale',
    history: [
      { role: 'user', message: 'in via del Porto Fluviale 5 c’è un campetto da basket libero che non trovo, aggiungilo: si chiama Playground Porto Fluviale' },
      { role: 'agent', tool_calls: [{ tool: 'cerca_impianti', params: { q: 'Playground Porto Fluviale' } }] },
      { role: 'agent', tool_results: [{ tool: 'cerca_impianti', result: { totale: 0, risultati: [], url: '/mappa?q=Playground+Porto+Fluviale' } }] },
      { role: 'agent', tool_calls: [{ tool: 'naviga', params: { url: '/mappa?q=Playground+Porto+Fluviale' } }] },
      { role: 'agent', tool_results: [{ tool: 'naviga', result: 'ok' }] },
    ],
    tool: 'segnala_luogo',
    params: { nome: re('(?i)porto fluviale'), indirizzo: re('(?i)porto fluviale'), sport: re('(?i)basket') },
  },
  { name: 'inglese: le mie attività', prio: 3, say: 'what activities am I signed up for?', tool: 'le_mie_attivita' },
];

// ─── Id degli strumenti ────────────────────────────────────────────────────
const { tools } = await api<{ tools: { id: string; tool_config: { name: string } }[] }>('GET', '/v1/convai/tools?types=client');
const { mcp_servers } = await api<{ mcp_servers: { id: string; config: { name: string } }[] }>('GET', '/v1/convai/mcp-servers');
const mcpId = mcp_servers.find((s) => s.config.name === MCP)?.id;
const MCP_TOOLS = new Set(['cerca_impianti', 'dettagli_luogo', 'cerca_attivita', 'dettagli_attivita']);
function ref(name: string) {
  if (MCP_TOOLS.has(name)) return { id: `mcp:${mcpId}:${name}`, type: 'mcp' as const };
  const t = tools.find((x) => x.tool_config.name === name);
  if (!t) throw new Error(`Strumento ${name} non trovato`);
  return { id: t.id, type: 'client' as const };
}
const llmName = (name: string) => (MCP_TOOLS.has(name) ? `${MCP}_${name}` : name);

let seq = 0;
function history(turns: Turn[] = []) {
  return turns.map((t, i) => ({
    role: t.role,
    time_in_call_secs: i,
    message: t.message,
    tool_calls: t.tool_calls?.map((c) => ({ request_id: `r${seq}`, tool_name: llmName(c.tool), params_as_json: JSON.stringify(c.params), tool_has_been_called: true })),
    tool_results: t.tool_results?.map((r) => ({
      request_id: `r${seq++}`,
      tool_name: llmName(r.tool),
      result_value: JSON.stringify(r.result),
      is_error: false,
      tool_has_been_called: true,
    })),
  }));
}

// ─── Crea o aggiorna, poi lancia ───────────────────────────────────────────
const [maxPrio = '1', filter = ''] = process.argv.slice(2);
// "2" = priorità fino a 2, "=2" = solo la 2
const only = maxPrio.startsWith('=');
const picked = CASES.filter((c) => (only ? c.prio === Number(maxPrio.slice(1)) : c.prio <= Number(maxPrio)) && c.name.includes(filter));
const existing = (await api<{ tests: { id: string; name: string }[] }>('GET', '/v1/convai/agent-testing?page_size=100')).tests;
const ids: { id: string; c: Case }[] = [];
for (const c of picked) {
  const hist = history(c.history);
  // L'ultimo messaggio dell'utente è la frase da provare (se la storia non lo contiene già)
  const last = c.history?.at(-1);
  if (!(last?.role === 'user' && last.message === c.say) && !last?.tool_results)
    hist.push({ role: 'user', time_in_call_secs: hist.length, message: c.say } as never);
  const body = {
    type: 'tool',
    name: `sic: ${c.name}`,
    chat_history: hist,
    check_any_tool_matches: true,
    dynamic_variables: { oggi: 'sabato 14 novembre 2026, ore 10:00' },
    tool_call_parameters: {
      referenced_tool: ref(c.tool),
      parameters: Object.entries(c.params ?? {}).map(([path, e]) => ({ path, eval: e })),
    },
  };
  const found = existing.find((t) => t.name === body.name);
  if (found) await api('PUT', `/v1/convai/agent-testing/${found.id}`, body);
  const id = found?.id ?? (await api<{ id: string }>('POST', '/v1/convai/agent-testing/create', body)).id;
  ids.push({ id, c });
}
console.log(`Lancio ${ids.length} test…`);
const run = await api<{ id: string }>('POST', `/v1/convai/agents/${AGENT}/run-tests`, { tests: ids.map(({ id }) => ({ test_id: id })) });

type Run = { test_id: string; status: string; credits_used?: number; condition_result?: { result?: string; rationale?: { summary?: string; messages?: string[] } }; agent_responses?: { tool_calls?: { tool_name: string; params_as_json: string }[]; message?: string }[] };
let runs: Run[] = [];
for (let i = 0; i < 60; i++) {
  runs = (await api<{ test_runs: Run[] }>('GET', `/v1/convai/test-invocations/${run.id}`)).test_runs;
  if (runs.every((r) => r.status !== 'pending')) break;
  await new Promise((r) => setTimeout(r, 3000));
}
let failed = 0;
for (const r of runs) {
  const c = ids.find((x) => x.id === r.test_id)!.c;
  const calls = (r.agent_responses ?? []).flatMap((a) => (a.tool_calls ?? []).map((t) => `${t.tool_name}(${t.params_as_json})`));
  const said = (r.agent_responses ?? []).map((a) => a.message).filter(Boolean).join(' ');
  if (r.status !== 'passed') failed++;
  console.log(`${r.status === 'passed' ? '✓' : '✗'} [P${c.prio}] ${c.name} — ${r.status}`);
  if (r.status !== 'passed') console.log(`    "${c.say}" → ${calls.join(', ') || '(nessuno strumento)'} ${said ? `| disse: ${said.slice(0, 160)}` : ''}`, r.condition_result?.rationale?.summary ?? '');
}
console.log(`${runs.length - failed}/${runs.length} passati · crediti usati: ${runs.reduce((n, r) => n + (r.credits_used ?? 0), 0)}`);
process.exit(failed ? 1 : 0);
