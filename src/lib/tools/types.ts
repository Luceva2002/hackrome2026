import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';

/**
 * Uno strumento dell'assistente: lo stesso oggetto viene esposto via MCP
 * (letture, eseguite sul server) o come client tool ElevenLabs (scritture e
 * navigazione, eseguite nel browser con il login dell'utente).
 */
export interface Tool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  /** Letta dall'LLM: dice quando usarlo, non come è fatto */
  description: string;
  input: S;
  run: (input: z.infer<S>, ctx: { sb: SupabaseClient }) => Promise<unknown>;
}

export const defineTool = <S extends z.ZodTypeAny>(t: Tool<S>) => t;
