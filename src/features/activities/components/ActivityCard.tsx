import Link from 'next/link';
import { Accessibility, ChevronRight, MapPin } from 'lucide-react';

import { activityCost, costText } from '@/lib/cost';
import { formatSlot } from '@/lib/rome-time';
import { getDiscipline } from '@/lib/sports/taxonomy';
import { LEVEL_LABELS, type ActivityWithMe } from '../types';

export function CostBadge({ priceNote }: { priceNote: string | null }) {
  const c = activityCost(priceNote);
  const tone =
    c.cost === 'gratuito'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
      : c.cost === 'a_pagamento'
        ? 'bg-white text-hi border-(--stroke-dark)'
        : 'bg-white text-mid border-(--stroke)';
  return (
    <span className={`inline-flex items-center h-7 px-2.5 rounded-full border text-[12px] font-bold max-w-full ${tone}`}>
      <span className="truncate">{c.cost === 'a_pagamento' ? c.price : costText(c, true)}</span>
    </span>
  );
}

export function spotsText(a: ActivityWithMe) {
  if (a.status === 'cancelled') return 'Annullata';
  if (a.spots_left > 0) return `${a.spots_left} ${a.spots_left === 1 ? 'posto libero' : 'posti liberi'} su ${a.capacity}`;
  return a.waitlist_count > 0 ? `Completa · ${a.waitlist_count} in lista d'attesa` : 'Completa · lista d\'attesa aperta';
}

export function ActivityCard({ a }: { a: ActivityWithMe }) {
  const d = getDiscipline(a.discipline);
  const mine = a.is_owner ? 'La organizzi tu' : a.my_status === 'confirmed' ? 'Sei iscritto' : a.my_status === 'waitlist' ? 'Sei in lista d\'attesa' : null;
  return (
    <Link
      href={`/attivita/${a.id}`}
      className={`card rounded-[24px] p-4 flex items-start gap-3 hover:bg-(--surface-muted) transition-colors ${a.status === 'cancelled' ? 'opacity-60' : ''}`}
    >
      <span className="w-11 h-11 rounded-2xl bg-(--gold-tint) flex items-center justify-center text-[22px] shrink-0" aria-hidden>
        {d.emoji}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-bold text-hi leading-snug">{a.title}</span>
        <span className="block text-[13px] text-mid mt-0.5">{formatSlot(a.starts_at, a.ends_at)}</span>
        <span className="flex items-center gap-1 text-[13px] text-mid mt-0.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span className="truncate">{a.venue_name ?? a.place_label ?? 'Luogo da definire'}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5 mt-2">
          <CostBadge priceNote={a.price_note} />
          <span className="inline-flex items-center h-7 px-2.5 rounded-full border border-(--stroke) text-[12px] font-semibold text-hi">{LEVEL_LABELS[a.level]}</span>
          {a.accessible && (
            <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-sky-50 border border-sky-100 text-sky-800 text-[12px] font-semibold">
              <Accessibility className="w-3.5 h-3.5" aria-hidden /> Accessibile
            </span>
          )}
        </span>
        <span className="block text-[13px] font-semibold text-hi mt-2">
          {spotsText(a)}
          {mine && <span className="text-gold-600"> · {mine}</span>}
        </span>
      </span>
      <ChevronRight className="w-5 h-5 text-low shrink-0 mt-3" aria-hidden />
    </Link>
  );
}
