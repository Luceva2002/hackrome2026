/**
 * Nome dell'app: cambialo solo qui.
 * `APP_NAME_PARTS` serve al logo (prima parte scura, seconda dorata).
 */
export const APP_NAME_PARTS = ['Sport', 'InComune'] as const;
export const APP_NAME = APP_NAME_PARTS.join('');
export const APP_TAGLINE = 'Dove fare sport a Roma';

/**
 * Immagine definitiva del simbolo (es. generata con Higgsfield) in public/brand/.
 * Finché è null si usa il disegno vettoriale: niente richieste a file che non esistono.
 */
export const LOGO_MARK_FILE: string | null = null; // es. '/brand/logo-mark.svg'
