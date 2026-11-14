import { getVenueKind } from '@/lib/sports/taxonomy';

/**
 * Immagine segnaposto per i luoghi senza foto: un'illustrazione del tipo di luogo
 * (colore e simbolo della tipologia, linee di un campo), dichiarata come illustrazione.
 * Non è una foto del luogo e non viene mai presentata come tale.
 */
export function VenuePlaceholder({ kind, seed = '', size = 'md' }: { kind: string; seed?: string; size?: 'md' | 'lg' }) {
  const k = getVenueKind(kind);
  // piccola variazione stabile per luogo, così le card vicine non sono identiche
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const angle = 115 + (h % 50);
  const flip = h % 2 === 0;
  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: `linear-gradient(${angle}deg, ${k.color} 0%, ${k.color}cc 45%, ${k.color}80 100%)` }}
      role="img"
      aria-label={`Illustrazione: ${k.label.toLowerCase()}. Nessuna foto del luogo disponibile`}
    >
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" style={{ transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden>
        <g fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="3">
          <rect x="-40" y="50" width="330" height="220" rx="6" transform="rotate(-14 120 160)" />
          <line x1="125" y1="35" x2="125" y2="285" transform="rotate(-14 120 160)" />
          <circle cx="125" cy="160" r="46" transform="rotate(-14 120 160)" />
          <rect x="-40" y="105" width="60" height="110" transform="rotate(-14 120 160)" />
        </g>
        <circle cx="330" cy="50" r="90" fill="#ffffff" fillOpacity="0.12" />
        <circle cx="360" cy="270" r="60" fill="#000000" fillOpacity="0.08" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`${size === 'lg' ? 'w-24 h-24 text-[52px]' : 'w-20 h-20 text-[42px]'} rounded-full bg-white/90 shadow-lg flex items-center justify-center`}
          aria-hidden
        >
          {k.emoji}
        </span>
      </div>
      <span className="absolute bottom-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/45 text-white">Illustrazione · {k.label}</span>
    </div>
  );
}
