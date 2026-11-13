import { z } from 'zod';

import { parseMunicipio } from '@/lib/sports/taxonomy';
import { daypartOf, whenRange, type DaypartFilter, type WhenFilter } from '@/lib/rome-time';
import type { ActivityPublic } from './types';

export const activityFiltersSchema = z.object({
  quando: z.enum(['oggi', 'domani', 'weekend', 'settimana']).optional().describe('Periodo'),
  fascia: z.enum(['mattina', 'pomeriggio', 'sera']).optional().describe('Fascia oraria'),
  disciplina: z.string().optional(),
  livello: z.enum(['principiante', 'intermedio', 'avanzato', 'tutti']).optional(),
  municipio: z.union([z.number().int().min(1).max(15), z.string()]).optional(),
  posti_liberi: z.boolean().optional().describe('Solo attività con posti ancora liberi'),
  accessibile: z.boolean().optional(),
  luogo: z.string().optional().describe('Id del luogo ospitante'),
});

export type ActivityFilters = z.infer<typeof activityFiltersSchema>;

const GROUPS: Record<string, string[]> = { calcio: ['calcio5', 'calcio8', 'calcio11'] };

export function filterActivities(list: ActivityPublic[], f: ActivityFilters, now = new Date()): ActivityPublic[] {
  const range = f.quando ? whenRange(f.quando as WhenFilter, now) : null;
  const mun = f.municipio != null ? parseMunicipio(f.municipio) : null;
  return list.filter((a) => {
    const start = new Date(a.starts_at);
    if (start < now) return false;
    if (range && (start < range.from || start >= range.to)) return false;
    if (f.fascia && daypartOf(a.starts_at) !== (f.fascia as DaypartFilter)) return false;
    if (f.disciplina && a.discipline !== f.disciplina && !GROUPS[f.disciplina]?.includes(a.discipline)) return false;
    if (f.livello && a.level !== f.livello && a.level !== 'tutti') return false;
    if (mun && a.municipio !== mun) return false;
    if (f.posti_liberi && a.spots_left <= 0) return false;
    if (f.accessibile && !a.accessible) return false;
    if (f.luogo && a.venue_id !== f.luogo) return false;
    return a.status === 'published';
  });
}

export function activityFiltersToParams(f: ActivityFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.quando) p.set('quando', f.quando);
  if (f.fascia) p.set('fascia', f.fascia);
  if (f.disciplina) p.set('disciplina', f.disciplina);
  if (f.livello) p.set('livello', f.livello);
  const m = f.municipio != null ? parseMunicipio(f.municipio) : null;
  if (m) p.set('municipio', String(m));
  if (f.posti_liberi) p.set('posti_liberi', '1');
  if (f.accessibile) p.set('accessibile', '1');
  if (f.luogo) p.set('luogo', f.luogo);
  return p;
}

export function paramsToActivityFilters(p: URLSearchParams): ActivityFilters {
  const raw = {
    quando: p.get('quando') ?? undefined,
    fascia: p.get('fascia') ?? undefined,
    disciplina: p.get('disciplina') ?? undefined,
    livello: p.get('livello') ?? undefined,
    municipio: parseMunicipio(p.get('municipio')) ?? undefined,
    posti_liberi: p.get('posti_liberi') === '1' || undefined,
    accessibile: p.get('accessibile') === '1' || undefined,
    luogo: p.get('luogo') ?? undefined,
  };
  const parsed = activityFiltersSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export const createActivitySchema = z
  .object({
    title: z.string().trim().min(3).max(80),
    description: z.string().trim().max(600).default(''),
    discipline: z.string().min(2).max(40),
    level: z.enum(['principiante', 'intermedio', 'avanzato', 'tutti']).default('tutti'),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }).optional().nullable(),
    capacity: z.number().int().min(1).max(500),
    venue_id: z.string().min(1).max(64),
    accessible: z.boolean().default(false),
    price_note: z.string().trim().max(80).optional().nullable(),
  })
  .refine((d) => new Date(d.starts_at) > new Date(), { message: 'La data deve essere nel futuro', path: ['starts_at'] })
  .refine((d) => !d.ends_at || new Date(d.ends_at) > new Date(d.starts_at), {
    message: 'La fine deve essere dopo l’inizio',
    path: ['ends_at'],
  });

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
