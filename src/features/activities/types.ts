export type ActivityLevel = 'principiante' | 'intermedio' | 'avanzato' | 'tutti';

export const LEVEL_LABELS: Record<ActivityLevel, string> = {
  tutti: 'Aperta a tutti',
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzato: 'Avanzato',
};

export type ParticipationStatus = 'confirmed' | 'waitlist';

/** Attività come la vede chiunque: solo contatori, nessun dato degli iscritti. */
export interface ActivityPublic {
  id: string;
  venue_id: string | null;
  venue_name: string | null;
  title: string;
  description: string;
  discipline: string;
  level: ActivityLevel;
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  confirmed_count: number;
  waitlist_count: number;
  spots_left: number;
  accessible: boolean;
  price_note: string | null;
  status: 'published' | 'cancelled';
  latitude: number | null;
  longitude: number | null;
  municipio: number | null;
  place_label: string | null;
  is_demo: boolean;
  owner_name: string;
  owner_is_venue_manager: boolean | null;
}

export interface ActivityWithMe extends ActivityPublic {
  my_status: ParticipationStatus | null;
  is_owner: boolean;
}
