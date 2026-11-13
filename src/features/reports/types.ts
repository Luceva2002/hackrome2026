import type { CIVIC_CATEGORIES } from '@/features/reports/constants';

export type CivicCategory = (typeof CIVIC_CATEGORIES)[number]['id'];

export type CategoryMeta = {
  id: string;
  emoji: string;
  labelKey: string;
  descKey: string;
  color: string;
};

export type ReportStatus = 'open' | 'in_progress' | 'resolved';

export interface CivicReportRecord {
  id: string;
  category: string;
  description: string;
  address: string | null;
  city: string | null;
  photo_url: string | null;
  status: ReportStatus;
  rewarded: boolean;
  created_at: string;
  latitude: number;
  longitude: number;
  is_mine?: boolean;
  /** Validazione della comunità */
  likes: number;
  dislikes: number;
  comments_count: number;
  /** 1 = like, -1 = dislike, 0/undefined = nessun voto */
  my_vote: number;
}

/** Campi sociali che il dettaglio può aggiornare sulla lista del genitore */
export type ReportSocialPatch = Partial<
  Pick<CivicReportRecord, 'likes' | 'dislikes' | 'my_vote' | 'comments_count'>
>;

export interface ReportComment {
  id: string;
  body: string;
  created_at: string;
  author: string;
  is_mine: boolean;
}

/** Aggregati sociali restituiti dopo un voto */
export interface VoteSummary {
  likes: number;
  dislikes: number;
  my_vote: number;
}

/** Premio XP/monete restituito dopo la creazione di una segnalazione */
export interface ReportReward {
  xp: number;
  coins: number;
  level: number;
  xpAwarded: number;
  coinsAwarded: number;
  leveledUp: boolean;
}
