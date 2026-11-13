'use client';

import { Accessibility, LocateFixed, Search, X } from 'lucide-react';

import { DISCIPLINES, MUNICIPI, NATURE_LABELS, VENUE_KINDS } from '@/lib/sports/taxonomy';
import type { VenueFilters } from '../filters';

interface Props {
  filters: VenueFilters;
  onChange: (f: VenueFilters) => void;
  onNearMe: () => void;
  locating?: boolean;
}

export const DISCIPLINE_GROUPS = [{ id: 'calcio', label: 'Calcio (tutte le varianti)' }];

const selectClass =
  'h-11 shrink-0 rounded-xl bg-white border border-(--stroke-dark) pl-3 pr-8 text-[14px] font-semibold text-hi appearance-none cursor-pointer focus-visible:outline-gold-600 bg-[length:16px] bg-[right_10px_center] bg-no-repeat';
const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475467' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

function Toggle({
  pressed,
  onClick,
  children,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`h-11 px-3.5 rounded-xl border text-[14px] font-bold flex items-center gap-2 shrink-0 transition-colors ${
        pressed ? 'bg-ink text-white border-ink' : 'bg-white text-hi border-(--stroke-dark) hover:bg-(--surface-muted)'
      }`}
    >
      {children}
    </button>
  );
}

export function VenueFiltersBar({ filters, onChange, onNearMe, locating }: Props) {
  const set = (p: Partial<VenueFilters>) => onChange({ ...filters, ...p });
  const active =
    Object.keys(filters).filter((k) => filters[k as keyof VenueFilters] != null && filters[k as keyof VenueFilters] !== '')
      .length > 0;

  return (
    <form
      role="search"
      aria-label="Filtra i luoghi"
      onSubmit={(e) => e.preventDefault()}
      className="glass-heavy rounded-[22px] p-2 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2 h-11 px-3 rounded-xl bg-white border border-(--stroke-dark) focus-within:border-gold-500">
        <Search className="w-4 h-4 text-low shrink-0" aria-hidden />
        <label htmlFor="venue-q" className="sr-only">
          Cerca per nome o indirizzo
        </label>
        <input
          id="venue-q"
          type="search"
          value={filters.q ?? ''}
          onChange={(e) => set({ q: e.target.value || undefined })}
          placeholder="Cerca un impianto o una via"
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-hi placeholder:text-low"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        <label className="sr-only" htmlFor="f-disciplina">
          Disciplina
        </label>
        <select
          id="f-disciplina"
          className={selectClass}
          style={{ backgroundImage: chevron }}
          value={filters.disciplina ?? ''}
          onChange={(e) => set({ disciplina: e.target.value || undefined })}
        >
          <option value="">Tutte le discipline</option>
          {DISCIPLINE_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
          {DISCIPLINES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="f-tipo">
          Tipologia
        </label>
        <select
          id="f-tipo"
          className={selectClass}
          style={{ backgroundImage: chevron }}
          value={filters.tipo ?? ''}
          onChange={(e) => set({ tipo: e.target.value || undefined })}
        >
          <option value="">Ogni tipologia</option>
          {VENUE_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="f-municipio">
          Municipio
        </label>
        <select
          id="f-municipio"
          className={selectClass}
          style={{ backgroundImage: chevron }}
          value={filters.municipio != null ? String(filters.municipio) : ''}
          onChange={(e) => set({ municipio: e.target.value ? Number(e.target.value) : undefined, vicino: undefined })}
        >
          <option value="">Tutti i Municipi</option>
          {MUNICIPI.map((m, i) => (
            <option key={m} value={i + 1}>
              Municipio {m}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="f-natura">
          Natura dello spazio
        </label>
        <select
          id="f-natura"
          className={selectClass}
          style={{ backgroundImage: chevron }}
          value={filters.natura ?? ''}
          onChange={(e) => set({ natura: e.target.value || undefined })}
        >
          <option value="">Pubblico o privato</option>
          {Object.entries(NATURE_LABELS)
            .filter(([k]) => k !== 'da_verificare')
            .map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
        </select>

        <Toggle
          pressed={!!filters.accessibile}
          onClick={() => set({ accessibile: filters.accessibile ? undefined : true })}
          label="Solo luoghi con accessibilità dichiarata"
        >
          <Accessibility className="w-4 h-4" aria-hidden />
          Accessibile
        </Toggle>

        <Toggle
          pressed={!!filters.vicino}
          onClick={() => (filters.vicino ? set({ vicino: undefined }) : onNearMe())}
          label={filters.vicino ? `Entro ${filters.vicino.km} km da te, tocca per rimuovere` : 'Vicino a me, entro 2 km'}
        >
          <LocateFixed className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} aria-hidden />
          {filters.vicino ? `Entro ${filters.vicino.km} km` : 'Vicino a me'}
        </Toggle>

        {active && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="h-11 px-3 rounded-xl text-[14px] font-bold text-mid hover:text-hi flex items-center gap-1 shrink-0"
          >
            <X className="w-4 h-4" aria-hidden />
            Azzera
          </button>
        )}
      </div>
    </form>
  );
}
