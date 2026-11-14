/**
 * Confronto di testi detti a voce o scritti di fretta: "Torre vecchia", "torrevecchia"
 * e "torra vecia" devono trovare la stessa cosa.
 */

/** minuscole, senza accenti né punteggiatura */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** senza spazi: "torre vecchia" = "torrevecchia" */
export const compact = (s: string) => fold(s).replace(/ /g, '');

/**
 * Come si sente, non come si scrive: doppie, "h", "k/y/j" non contano
 * ("torra vecia" ≈ "Torrevecchia", "garbatela" ≈ "Garbatella").
 */
export const sound = (s: string) =>
  compact(s)
    .replace(/h/g, '')
    .replace(/k/g, 'c')
    .replace(/[yj]/g, 'i')
    .replace(/(.)\1+/g, '$1');

/**
 * Errori ammessi per lunghezza: le parole corte devono essere esatte.
 * shortcut: 1 errore su 5 lettere fa trovare "casa" per "casia"; si usa solo se il testo esatto non trova nulla
 * e lo strumento lo segnala come approssimato. Se dà fastidio, passare a un indice fonetico per parola.
 */
export const tolerance = (len: number) => (len >= 9 ? 2 : len >= 5 ? 1 : 0);

/** Distanza di Levenshtein fra due parole intere */
export function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), prev[j] + 1, cur[j - 1] + 1);
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Distanza minima fra `needle` e una qualunque parte di `hay` (algoritmo di Sellers):
 * quante lettere cambiare, togliere o aggiungere perché `needle` compaia in `hay`.
 */
export function substringDistance(needle: string, hay: string): number {
  const m = needle.length;
  if (!m) return 0;
  let prev = Array.from({ length: m + 1 }, (_, i) => i);
  let best = prev[m];
  for (let j = 1; j <= hay.length; j++) {
    const cur = [0]; // si può iniziare in qualunque punto di hay
    for (let i = 1; i <= m; i++) {
      const cost = needle[i - 1] === hay[j - 1] ? 0 : 1;
      cur[i] = Math.min(prev[i - 1] + cost, prev[i] + 1, cur[i - 1] + 1);
    }
    best = Math.min(best, cur[m]);
    prev = cur;
  }
  return best;
}

/** `needle` compare in `hay` con al massimo gli errori ammessi per la sua lunghezza */
export const fuzzyIncludes = (needle: string, hay: string) => {
  const n = sound(needle);
  return substringDistance(n, sound(hay)) <= tolerance(n.length);
};
