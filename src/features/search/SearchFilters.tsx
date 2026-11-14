'use client';

import { motion } from 'motion/react';
import { Accessibility, LocateFixed, Search, X } from 'lucide-react';

import { DISCIPLINES, MUNICIPI, NATURE_LABELS, VENUE_KINDS } from '@/lib/sports/taxonomy';
import type { VenueFilters } from '@/features/venues/filters';

/** Sport mostrati come chip, in ordine di richiesta; gli altri nel menu "Altri sport". */
const TOP_SPORTS: { id: string; label: string; emoji: string }[] = [
  { id: 'calcio', label: 'Calcio', emoji: '⚽' },
  ...['basket', 'volley', 'tennis', 'nuoto', 'atletica', 'ginnastica', 'danza', 'arti_marziali', 'pugilato', 'rugby', 'pattinaggio', 'arrampicata', 'scherma'].map(
    (id) => {
      const d = DISCIPLINES.find((x) => x.id === id)!;
      return { id, label: d.id === 'arti_marziali' ? 'Arti marziali' : d.label, emoji: d.emoji };
    },
  ),
];
const TOP_IDS = new Set(TOP_SPORTS.map((s) => s.id));
const OTHER_SPORTS = DISCIPLINES.filter((d) => !TOP_IDS.has(d.id) && d.group !== 'calcio' && d.group !== 'arti_marziali');

const NATURE_OPTIONS = (Object.keys(NATURE_LABELS) as (keyof typeof NATURE_LABELS)[]).filter((k) => k !== 'da_verificare');

export function Chip({
  pressed,
  onClick,
  children,
  label,
  className = '',
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`h-chip shrink-0 px-3.5 rounded-full text-[14px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors duration-200 ${
        pressed ? 'bg-ink text-white border border-ink shadow-[0_4px_12px_rgba(15,23,42,0.25)]' : 'glass-well text-hi hover:bg-white'
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}

function Section({ title, children, scroll }: { title: string; children: React.ReactNode; scroll?: boolean }) {
  return (
    <fieldset className="mt-6 first:mt-2 min-w-0">
      <legend className="eyebrow mb-2.5">{title}</legend>
      {scroll ? (
        <div className="-mx-pad px-pad flex gap-2 overflow-x-auto no-scrollbar scroll-px-pad snap-x">{children}</div>
      ) : (
        <div className="flex flex-wrap gap-2">{children}</div>
      )}
    </fieldset>
  );
}

/** Campo di ricerca in cima alla tendina */
export function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 h-12 pl-4 pr-1.5 rounded-full glass-well focus-within:border-gold-500 focus-within:bg-white transition-colors">
      <Search className="w-5 h-5 text-mid shrink-0" aria-hidden />
      <label htmlFor="venue-q" className="sr-only">
        Cerca per nome o indirizzo
      </label>
      <input
        id="venue-q"
        data-autofocus
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Impianto, via o quartiere"
        style={{ outline: 'none' }}
        className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-hi placeholder:text-low [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Cancella il testo"
          className="w-9 h-9 rounded-full flex items-center justify-center text-mid hover:bg-black/5"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

export function SearchFilters({
  filters,
  onChange,
  onNearMe,
  locating,
}: {
  filters: VenueFilters;
  onChange: (f: VenueFilters) => void;
  onNearMe: () => void;
  locating?: boolean;
}) {
  const set = (p: Partial<VenueFilters>) => onChange({ ...filters, ...p });
  const toggle = <K extends keyof VenueFilters>(k: K, v: VenueFilters[K]) => set({ [k]: filters[k] === v ? undefined : v } as Partial<VenueFilters>);
  const otherSelected = filters.disciplina && !TOP_IDS.has(filters.disciplina) ? filters.disciplina : '';

  return (
    <div role="group" aria-label="Filtri">
      <Section title="In evidenza" scroll>
        <Chip
          pressed={!!filters.vicino}
          onClick={() => (filters.vicino ? set({ vicino: undefined }) : onNearMe())}
          label={filters.vicino ? `Entro ${filters.vicino.km} km da te, tocca per rimuovere` : 'Vicino a me, entro 2 km'}
        >
          <LocateFixed className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} aria-hidden />
          {filters.vicino ? `Entro ${filters.vicino.km} km` : 'Vicino a me'}
        </Chip>
        <Chip pressed={!!filters.accessibile} onClick={() => set({ accessibile: filters.accessibile ? undefined : true })}>
          <Accessibility className="w-4 h-4" aria-hidden />
          Accessibile
        </Chip>
      </Section>

      <Section title="Sport" scroll>
        {TOP_SPORTS.map((s) => (
          <Chip key={s.id} pressed={filters.disciplina === s.id} onClick={() => toggle('disciplina', s.id)}>
            <span aria-hidden>{s.emoji}</span>
            {s.label}
          </Chip>
        ))}
        <label className="relative shrink-0">
          <span className="sr-only">Altri sport</span>
          <select
            value={otherSelected}
            onChange={(e) => set({ disciplina: e.target.value || undefined })}
            className={`h-chip pl-3.5 pr-8 rounded-full text-[14px] font-semibold appearance-none cursor-pointer ${
              otherSelected ? 'bg-ink text-white' : 'glass-well text-hi'
            }`}
          >
            <option value="">Altri sport…</option>
            {OTHER_SPORTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" aria-hidden>
            ▼
          </span>
        </label>
      </Section>

      <Section title="Tipo di luogo">
        {VENUE_KINDS.map((k) => (
          <Chip key={k.id} pressed={filters.tipo === k.id} onClick={() => toggle('tipo', k.id)}>
            <span
              className="w-6 h-6 -ml-1 rounded-full flex items-center justify-center text-[13px]"
              style={{ background: filters.tipo === k.id ? 'rgba(255,255,255,0.18)' : `${k.color}22` }}
              aria-hidden
            >
              {k.emoji}
            </span>
            {k.label}
          </Chip>
        ))}
      </Section>

      <Section title="Municipio" scroll>
        {MUNICIPI.map((m, i) => (
          <Chip
            key={m}
            pressed={filters.municipio === i + 1}
            onClick={() => set({ municipio: filters.municipio === i + 1 ? undefined : i + 1, vicino: undefined })}
            label={`Municipio ${m}`}
            className="min-w-11 justify-center px-3"
          >
            {m}
          </Chip>
        ))}
      </Section>

      <Section title="Gestione">
        {NATURE_OPTIONS.map((k) => (
          <Chip key={k} pressed={filters.natura === k} onClick={() => toggle('natura', k)}>
            {NATURE_LABELS[k]}
          </Chip>
        ))}
      </Section>
    </div>
  );
}
