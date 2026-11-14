// Crea o aggiorna l'agente ElevenLabs di SportInComune: server MCP, client tool, prompt, lingue, accesso privato.
// Idempotente: ritrova MCP e tool per nome, l'agente da ELEVENLABS_AGENT_ID (se manca lo crea e stampa l'id).
//
//   node --env-file=.env.local --import tsx scripts/elevenlabs-setup.mts https://<sito-su-vercel>
//
// Servono in .env.local: ELEVENLABS_API_KEY, MCP_SECRET (lo stesso impostato su Vercel).
import { readFileSync } from 'node:fs';

const KEY = process.env.ELEVENLABS_API_KEY;
const SECRET = process.env.MCP_SECRET;
const SITE = process.argv[2];
if (!KEY || !SECRET || !SITE?.startsWith('https://')) {
  console.error('Uso: … elevenlabs-setup.mts https://<sito>   (con ELEVENLABS_API_KEY e MCP_SECRET in .env.local)');
  process.exit(1);
}

const LLM = 'gemini-2.5-flash'; // veloce e buono con gli strumenti; cambialo qui se le risposte non convincono
const NAME = 'SportInComune';

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`https://api.elevenlabs.io${path}`, {
    method,
    headers: { 'xi-api-key': KEY!, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}\n${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

// 1. MCP abilitato nel workspace
await api('PATCH', '/v1/convai/settings', { can_use_mcp_servers: true });

// 2. Server MCP (letture). url e trasporto non si aggiornano: se cambiano si ricrea.
const mcpUrl = new URL('/api/mcp', SITE).toString();
const { mcp_servers } = await api<{ mcp_servers: { id: string; config: { name: string; url: string } }[] }>('GET', '/v1/convai/mcp-servers');
let mcp = mcp_servers.find((s) => s.config.name === NAME);
if (mcp && mcp.config.url !== mcpUrl) {
  await api('DELETE', `/v1/convai/mcp-servers/${mcp.id}`);
  mcp = undefined;
}
const mcpCommon = { approval_policy: 'auto_approve_all', request_headers: { Authorization: `Bearer ${SECRET}` } };
if (mcp) await api('PATCH', `/v1/convai/mcp-servers/${mcp.id}`, mcpCommon);
else
  mcp = await api('POST', '/v1/convai/mcp-servers', {
    config: { name: NAME, url: mcpUrl, transport: 'STREAMABLE_HTTP', description: 'Luoghi e attività sportive di Roma (sola lettura)', ...mcpCommon },
  });
console.log('✓ MCP', mcp!.id, mcpUrl);

// 3. Client tool: eseguiti nel browser (src/features/assistant/elevenlabs-engine.ts, stessi nomi)
const CLIENT_TOOLS = [
  {
    name: 'naviga',
    description: 'Mostra una pagina dell’app. Passa l’url restituito da cerca_impianti, cerca_attivita, dettagli_luogo o dettagli_attivita.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'Percorso interno, es. /mappa?disciplina=basket' } }, required: ['url'] },
    expects_response: false,
  },
  {
    name: 'mappa',
    description: 'Muove la mappa: inquadra_risultati dopo una ricerca, panoramica di tutta Roma. Per un luogo preciso usa naviga con il suo url.',
    parameters: {
      type: 'object',
      properties: {
        azione: { type: 'string', enum: ['inquadra_risultati', 'panoramica'], description: 'Movimento della mappa' },
      },
      required: ['azione'],
    },
    expects_response: false,
  },
  {
    name: 'posizione',
    description: 'Posizione attuale dell’utente (chiede il permesso). Serve per “vicino a me”.',
    parameters: { type: 'object', properties: {} },
    expects_response: true,
    response_timeout_secs: 20,
  },
];
const toolIds: string[] = [];
for (const t of CLIENT_TOOLS) {
  const { tools } = await api<{ tools: { id: string; tool_config: { name: string } }[] }>('GET', `/v1/convai/tools?types=client&search=${t.name}`);
  const found = tools.find((x) => x.tool_config.name === t.name);
  const body = { tool_config: { type: 'client', ...t } };
  const saved = found ? await api<{ id: string }>('PATCH', `/v1/convai/tools/${found.id}`, body) : await api<{ id: string }>('POST', '/v1/convai/tools', body);
  toolIds.push(saved.id ?? found!.id);
}
console.log('✓ client tool', CLIENT_TOOLS.map((t) => t.name).join(', '));

// 4. Agente privato: solo con URL firmato da /api/assistant/session
const agent = {
  name: NAME,
  conversation_config: {
    agent: {
      language: 'it',
      first_message: '', // parla prima l'utente (tieni premuto o chat): un saluto costa crediti e ritarda la risposta
      prompt: {
        prompt: readFileSync(new URL('../src/lib/agent/voice-prompt.md', import.meta.url), 'utf8'),
        llm: LLM,
        tool_ids: toolIds,
        mcp_server_ids: [mcp!.id],
        built_in_tools: { language_detection: { name: 'language_detection', params: { system_tool_type: 'language_detection' } } },
      },
    },
    language_presets: { en: { overrides: { agent: { language: 'en' } } } },
    // Crediti: richiamo dopo 30 s di silenzio (7 s di default disturba in chat), chiusura dopo 60 s senza risposte
    turn: { turn_timeout: 30 },
    conversation: { max_duration_seconds: 600, max_duration_seconds_after_last_agent_message: 60 },
  },
  platform_settings: {
    auth: { enable_auth: true },
    overrides: { conversation_config_override: { conversation: { text_only: true } } }, // la chat apre sessioni solo testo
  },
};
const id = process.env.ELEVENLABS_AGENT_ID;
if (id) await api('PATCH', `/v1/convai/agents/${id}`, agent);
let agentId = id;
if (!agentId) {
  const created = await api<{ agent_id?: string }>('POST', '/v1/convai/agents/create', agent);
  if (!created.agent_id) throw new Error(`Creazione agente senza agent_id: ${JSON.stringify(created).slice(0, 500)}`);
  agentId = created.agent_id;
}
console.log(`✓ agente ${agentId}${id ? ' aggiornato' : ' creato: metti ELEVENLABS_AGENT_ID=' + agentId + ' in .env.local e su Vercel'}`);
