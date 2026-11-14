import type {
  Accessibility,
  OperationalStatus,
  VenueKind,
  VenueNature,
} from '@/lib/sports/taxonomy';
import type { Cost } from '@/lib/cost';

/** Da dove viene un campo della scheda: è la nostra credibilità. */
export interface FieldSource {
  /** id in data/sources.json, oppure 'gestore' | 'community' | 'derivato' */
  source: string;
  /** Valore grezzo letto dalla fonte, se diverso da quello mostrato */
  raw?: string;
  /** 0..1 */
  confidence: number;
  note?: string;
}

export type VenueField =
  | 'name'
  | 'address'
  | 'municipio'
  | 'position'
  | 'kind'
  | 'nature'
  | 'disciplines'
  | 'structures'
  | 'levels'
  | 'status'
  | 'accessibility'
  | 'opening_hours'
  | 'phone'
  | 'website'
  | 'cost'
  | 'description';

/** Scheda completa (dettaglio). */
export interface VenueRecord {
  id: string;
  name: string;
  address: string | null;
  municipio: number | null;
  latitude: number | null;
  longitude: number | null;
  kind: VenueKind;
  nature: VenueNature;
  disciplines: string[];
  structures: string | null;
  levels: string[];
  status: OperationalStatus;
  accessibility: Accessibility;
  opening_hours: string | null;
  phone: string | null;
  website: string | null;
  /** Costo: solo con fonte (gestore, fonte pubblica, proposta approvata); altrimenti 'da_verificare' */
  cost: Cost;
  cost_price: string | null;
  cost_note: string | null;
  description: string | null;
  community: boolean;
  manager_verified: boolean;
  needs_review: boolean;
  review_notes: string[];
  fields: Partial<Record<VenueField, FieldSource>>;
}

/** Versione leggera per la mappa e la lista. */
export type VenueSummary = Pick<
  VenueRecord,
  | 'id'
  | 'name'
  | 'address'
  | 'municipio'
  | 'latitude'
  | 'longitude'
  | 'kind'
  | 'nature'
  | 'disciplines'
  | 'structures'
  | 'status'
  | 'accessibility'
  | 'community'
  | 'manager_verified'
>;

export function toSummary(v: VenueRecord): VenueSummary {
  return {
    id: v.id,
    name: v.name,
    address: v.address,
    municipio: v.municipio,
    latitude: v.latitude,
    longitude: v.longitude,
    kind: v.kind,
    nature: v.nature,
    disciplines: v.disciplines,
    structures: v.structures,
    status: v.status,
    accessibility: v.accessibility,
    community: v.community,
    manager_verified: v.manager_verified,
  };
}
