import { timingSafeEqual } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createClient } from '@supabase/supabase-js';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase/config';
import { READ_TOOLS } from '@/lib/tools/read';

export const dynamic = 'force-dynamic';

/**
 * Server MCP per l'agente vocale (ElevenLabs lo chiama dal suo cloud).
 * Solo letture di dati pubblici: le scritture sono client tool nel browser,
 * con il login dell'utente. Senza sessione: ogni richiesta è indipendente.
 */

const SECRET = process.env.MCP_SECRET ?? '';

function authorized(req: Request) {
  const got = Buffer.from(req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '');
  const want = Buffer.from(SECRET);
  return SECRET.length >= 16 && got.length === want.length && timingSafeEqual(got, want);
}

function buildServer() {
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const server = new McpServer({ name: 'sportincomune', version: '0.1.0' });
  for (const tool of READ_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.input, annotations: { readOnlyHint: true } },
      async (input: unknown) => {
        try {
          const result = await tool.run(input as never, { sb });
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
        } catch (e) {
          console.error(`[mcp] ${tool.name}`, e);
          return { isError: true, content: [{ type: 'text' as const, text: 'Servizio non disponibile, riprova tra poco.' }] };
        }
      },
    );
  }
  return server;
}

async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const server = buildServer();
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
