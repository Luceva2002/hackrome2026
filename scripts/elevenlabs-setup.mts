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

// 2. Server MCP (letture). url e trasporto non si aggiornano: se cambiano se ne crea uno
// nuovo e il vecchio si cancella dopo aver spostato l'agente (finché lo usa, ElevenLabs dà 409).
const mcpUrl = new URL('/api/mcp', SITE).toString();
const { mcp_servers } = await api<{ mcp_servers: { id: string; config: { name: string; url: string } }[] }>('GET', '/v1/convai/mcp-servers');
const stale = mcp_servers.filter((s) => s.config.name === NAME && s.config.url !== mcpUrl);
let mcp = mcp_servers.find((s) => s.config.name === NAME && s.config.url === mcpUrl);
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
  // Scritture: la prima chiamata non fa nulla e mostra Conferma sullo schermo; si esegue solo
  // richiamando con gli stessi dati e confermato true dopo il sì dell'utente (src/features/assistant/confirm-store.ts)
  {
    name: 'iscriviti_attivita',
    description:
      'Iscrive l’utente a un’attività (o lo mette in lista d’attesa se è piena). Prima chiamata senza confermato: prepara e chiede conferma. ' +
      'Dopo un sì chiaro richiama con gli stessi parametri e confermato true.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id dell’attività (da cerca_attivita, dettagli_attivita o dettagli_luogo)' },
        confermato: { type: 'boolean', description: 'true solo dopo che l’utente ha detto sì a questa iscrizione' },
      },
      required: ['id'],
    },
    expects_response: true,
    response_timeout_secs: 15,
  },
  {
    name: 'annulla_iscrizione',
    description: 'Annulla l’iscrizione dell’utente a un’attività. Stesso schema di conferma di iscriviti_attivita.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id dell’attività' },
        confermato: { type: 'boolean', description: 'true solo dopo che l’utente ha detto sì' },
      },
      required: ['id'],
    },
    expects_response: true,
    response_timeout_secs: 15,
  },
  {
    name: 'crea_attivita',
    description:
      'Crea una nuova attività sportiva organizzata dall’utente in un luogo. Raccogli prima a voce i dati che mancano. ' +
      'Prima chiamata senza confermato: prepara e chiede conferma; dopo un sì richiama con gli stessi parametri e confermato true.',
    parameters: {
      type: 'object',
      properties: {
        titolo: { type: 'string', description: 'Titolo breve, es. "Partita di calcetto del sabato"' },
        disciplina: { type: 'string', description: 'Id dello sport, es. calcio5, basket, yoga, corsa' },
        luogo_id: { type: 'string', description: 'Id del luogo (da cerca_impianti o dettagli_luogo)' },
        giorno: { type: 'string', description: 'Data in formato AAAA-MM-GG, calcolata da oggi' },
        ora: { type: 'string', description: 'Ora di inizio HH:MM (24 ore)' },
        durata_minuti: { type: 'number', description: 'Durata in minuti (se non la dice: 90)' },
        posti: { type: 'number', description: 'Numero di partecipanti ammessi' },
        livello: { type: 'string', enum: ['tutti', 'principiante', 'intermedio', 'avanzato'], description: 'Livello richiesto (se non lo dice: tutti)' },
        descrizione: { type: 'string', description: 'Descrizione facoltativa' },
        accessibile: { type: 'boolean', description: 'Adatta a persone con disabilità' },
        costo: { type: 'string', description: 'Costo come lo dice l’utente, es. "Gratuita" o "5 euro"' },
        confermato: { type: 'boolean', description: 'true solo dopo che l’utente ha detto sì a questo riepilogo' },
      },
      required: ['titolo', 'disciplina', 'luogo_id', 'giorno', 'ora', 'posti'],
    },
    expects_response: true,
    response_timeout_secs: 15,
  },
  {
    name: 'le_mie_attivita',
    description: 'Attività future dell’utente: quelle che organizza e quelle a cui è iscritto (o in lista d’attesa).',
    parameters: { type: 'object', properties: {} },
    expects_response: true,
    response_timeout_secs: 15,
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
      // {{oggi}} lo passa il browser all'avvio (elevenlabs-engine.ts); questo vale solo se manca
      dynamic_variables: { dynamic_variable_placeholders: { oggi: 'data non disponibile: chiedi all’utente il giorno esatto' } },
      first_message: '', // parla prima l'utente (tieni premuto o chat): un saluto costa crediti e ritarda la risposta
      prompt: {
        prompt: readFileSync(new URL('../src/lib/agent/voice-prompt.md', import.meta.url), 'utf8'),
        llm: LLM,
        tool_ids: toolIds,
        mcp_server_ids: [mcp!.id],
        built_in_tools: {
          language_detection: { name: 'language_detection', params: { system_tool_type: 'language_detection' } },
          // Rumori, "eh", "...": resta zitto invece di "dimmi pure" (ogni frase costa crediti)
          skip_turn: { name: 'skip_turn', params: { system_tool_type: 'skip_turn' } },
        },
      },
    },
    language_presets: { en: { overrides: { agent: { language: 'en' } } } },
    // Espressiva aggiunge tag come "[slow]" anche nel testo della chat
    tts: { expressive_mode: false },
    // Crediti: richiamo dopo 30 s di silenzio (7 s di default disturba in chat); a voce si chiude dopo 45 s di silenzio
    turn: { turn_timeout: 30, silence_end_call_timeout: 45 },
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

// 5. Server MCP vecchi, ora che l'agente non li usa più
for (const s of stale) await api('DELETE', `/v1/convai/mcp-servers/${s.id}`);
if (stale.length) console.log('✓ rimossi server MCP vecchi:', stale.map((s) => s.config.url).join(', '));
