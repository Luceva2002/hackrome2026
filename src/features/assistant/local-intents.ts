/**
 * Comprensione locale delle richieste più semplici, senza modello e senza rete.
 * Serve finché il motore vero (Edo) non c'è, e come riserva se cade la rete:
 * riconosce sport, tipo di luogo, Municipio, accessibilità e "vicino a me" e li
 * trasforma in filtri della mappa. Non risponde a niente che non sappia.
 */
import { DISCIPLINES, MUNICIPI, VENUE_KINDS, parseMunicipio } from '@/lib/sports/taxonomy';
import type { VenueFilters } from '@/features/venues/filters';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const SPORT_WORDS: [RegExp, string][] = [
  [/\bcalc(io|etto)\b|\bpallone\b/, 'calcio'],
  [/\bbasket\b|pallacanestro/, 'basket'],
  [/pallavolo|\bvolley\b/, 'volley'],
  [/\btennis\b/, 'tennis'],
  [/\bpadel\b|squash/, 'padel_squash'],
  [/nuot|\bpiscin/, 'nuoto'],
  [/atletica|\bpista\b/, 'atletica'],
  [/\bcors[ae]\b|running/, 'corsa'],
  [/ginnastica/, 'ginnastica'],
  [/\bdanza\b|ballo/, 'danza'],
  [/\byoga\b/, 'yoga'],
  [/arti marziali|judo|karate|taekwondo/, 'arti_marziali'],
  [/pugilato|boxe/, 'pugilato'],
  [/\brugby\b/, 'rugby'],
  [/scherma/, 'scherma'],
  [/arrampicata|bouldering/, 'arrampicata'],
  [/pattin|skate/, 'pattinaggio'],
  [/ciclismo|\bbici/, 'ciclismo'],
];

const KIND_WORDS: [RegExp, string][] = [
  [/\bpiscin/, 'piscina'],
  [/palestr[ae] scolastic|\bscuol/, 'palestra_scolastica'],
  [/\bpalestr/, 'palestra'],
  [/centr[oi] sportiv/, 'centro_sportivo'],
  [/\bcamp(o|i)\b|all.aperto/, 'campo'],
  [/community|informal|parco/, 'spazio_informale'],
];

export interface LocalIntent {
  filters: VenueFilters;
  wantsNearMe: boolean;
  /** Descrizione di ciò che ho capito, per la risposta */
  understood: string[];
}

export function parseLocalIntent(text: string): LocalIntent | null {
  const t = fold(text);
  const f: VenueFilters = {};
  const understood: string[] = [];

  const sport = SPORT_WORDS.find(([re]) => re.test(t))?.[1];
  if (sport) {
    f.disciplina = sport;
    understood.push(sport === 'calcio' ? 'calcio' : (DISCIPLINES.find((d) => d.id === sport)?.label.toLowerCase() ?? sport));
  }
  const kind = KIND_WORDS.find(([re]) => re.test(t))?.[1];
  // "campi da basket", "piscine": con uno sport, la parola del luogo è generica e
  // restringerebbe troppo (es. escluderebbe i centri sportivi con il basket)
  if (kind && !(sport && (kind === 'campo' || kind === 'piscina' || kind === 'centro_sportivo'))) {
    f.tipo = kind;
    understood.push(VENUE_KINDS.find((k) => k.id === kind)!.label.toLowerCase());
  }
  const mun = t.match(/municipio\s+([ivx]+|\d{1,2})\b/);
  if (mun) {
    const n = parseMunicipio(mun[1].toUpperCase());
    if (n) {
      f.municipio = n;
      understood.push(`Municipio ${MUNICIPI[n - 1]}`);
    }
  }
  if (/accessibil|disabil|carrozzin|sedia a rotelle/.test(t)) {
    f.accessibile = true;
    understood.push('accessibili');
  }
  const wantsNearMe = /vicino|qui intorno|nei dintorni|vicinanz/.test(t);
  if (wantsNearMe) understood.push('vicino a te');

  return understood.length ? { filters: f, wantsNearMe, understood } : null;
}
