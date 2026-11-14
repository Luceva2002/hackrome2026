import { APP_NAME, APP_NAME_PARTS } from '@/lib/brand';
import { BrandMark } from './BrandMark';

interface BrandLogoProps {
  className?: string;
  /** Mostra solo il simbolo, senza scritta */
  markOnly?: boolean;
}

export const BRAND_NAME = APP_NAME;

/**
 * Logo dell'app — pin oro con un pallone stilizzato + wordmark.
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
      <BrandMark />

      {!markOnly && (
        <span className="font-bold tracking-tight inline-flex items-baseline" aria-hidden>
          <span className="text-hi">{APP_NAME_PARTS[0]}</span>
          <span className="text-gold-gradient">{APP_NAME_PARTS[1]}</span>
        </span>
      )}
    </span>
  );
}
