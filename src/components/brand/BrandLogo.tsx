interface BrandLogoProps {
  className?: string;
  /** Mostra solo il simbolo, senza scritta */
  markOnly?: boolean;
}

export const BRAND_NAME = 'RomaInCampo';

/**
 * Logo RomaInCampo — pin oro con un pallone stilizzato + wordmark.
 * Scala con il font-size del contenitore (usa className tipo `text-[42px]`).
 */
export function BrandLogo({ className = '', markOnly = false }: BrandLogoProps) {
  return (
    <span
      className={`inline-flex items-center gap-[0.26em] leading-none select-none ${className}`}
      style={{ fontFamily: 'var(--font-display)' }}
      role="img"
      aria-label={BRAND_NAME}
    >
      <svg viewBox="0 0 48 48" style={{ width: '1.08em', height: '1.08em' }} aria-hidden className="shrink-0">
        <defs>
          <linearGradient id="ric-mark-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd23e" />
            <stop offset="55%" stopColor="#f5b301" />
            <stop offset="100%" stopColor="#d89b00" />
          </linearGradient>
        </defs>
        <path
          d="M24 3.5C15.4 3.5 8.5 10.4 8.5 19c0 10.6 13 22.4 14.6 23.8a1.4 1.4 0 0 0 1.8 0C26.5 41.4 39.5 29.6 39.5 19c0-8.6-6.9-15.5-15.5-15.5z"
          fill="url(#ric-mark-gold)"
        />
        <ellipse cx="18.5" cy="11.5" rx="7.5" ry="4.6" fill="#ffffff" opacity="0.3" transform="rotate(-24 18.5 11.5)" />
        {/* Pallone */}
        <circle cx="24" cy="19" r="8.2" fill="#ffffff" />
        <path
          d="M24 13.6l3.6 2.6-1.4 4.2h-4.4l-1.4-4.2z M15.9 19.2l2.7-.4 1.3 3.9-2 2.4 M32.1 19.2l-2.7-.4-1.3 3.9 2 2.4"
          fill="none"
          stroke="#b07d00"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {!markOnly && (
        <span className="font-bold tracking-tight inline-flex items-baseline" aria-hidden>
          <span className="text-hi">Roma</span>
          <span className="text-gold-gradient">InCampo</span>
        </span>
      )}
    </span>
  );
}
