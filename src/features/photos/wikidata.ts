/**
 * Foto da Wikidata + Wikimedia Commons, cercate dal browser (le API Wikimedia
 * accettano CORS con origin=*).
 *
 * Regola anti-errore: accettiamo un elemento Wikidata solo se
 *  - ha una foto (P18) ed è entro MAX_M metri dal nostro punto, e
 *  - il suo nome condivide almeno una parola significativa con il nostro.
 * Altrimenti niente foto: meglio il segnaposto che la foto di un altro posto.
 */
import type { PhotoProvider, VenuePhoto } from './types';

const MAX_M = 250;
const SPARQL = 'https://query.wikidata.org/sparql';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

const STOP = new Set(
  'centro sportivo sportiva sportivi sport sports comunale municipale impianto impianti palestra palestre campo campi piscina piscine circolo club asd ssd srl associazione polisportiva societa scuola istituto comprensivo liceo statale roma via viale piazza largo della delle dello degli del dei di da the and stadio'.split(
    ' ',
  ),
);

export function nameTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

export function namesMatch(ours: string, theirs: string): boolean {
  const a = new Set(nameTokens(ours));
  return nameTokens(theirs).some((t) => a.has(t));
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

interface SparqlRow {
  item: { value: string };
  itemLabel?: { value: string };
  image: { value: string };
  dist: { value: string };
}

async function nearbyWithImage(lat: number, lng: number, signal?: AbortSignal) {
  const q = `SELECT ?item ?itemLabel ?image ?dist WHERE {
    SERVICE wikibase:around { ?item wdt:P625 ?loc .
      bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
      bd:serviceParam wikibase:radius "${MAX_M / 1000}" .
      bd:serviceParam wikibase:distance ?dist . }
    ?item wdt:P18 ?image .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
  } ORDER BY ?dist LIMIT 15`;
  const res = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(q)}`, {
    signal,
    headers: { Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error(`wikidata ${res.status}`);
  const json = (await res.json()) as { results: { bindings: SparqlRow[] } };
  return json.results.bindings.map((b) => ({
    qid: b.item.value.split('/').pop()!,
    label: b.itemLabel?.value ?? '',
    file: decodeURIComponent(b.image.value.split('/Special:FilePath/').pop() ?? ''),
    meters: Math.round(Number(b.dist.value) * 1000),
  }));
}

async function commonsInfo(file: string, signal?: AbortSignal) {
  const url = `${COMMONS}?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&titles=${encodeURIComponent(`File:${file}`)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`commons ${res.status}`);
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value: string }> }[] }> };
  };
  const info = Object.values(json.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!info?.thumburl || !info.descriptionurl) return null;
  const meta = info.extmetadata ?? {};
  return {
    url: info.thumburl,
    sourceUrl: info.descriptionurl,
    artist: stripHtml(meta.Artist?.value ?? '') || 'Autore su Commons',
    license: stripHtml(meta.LicenseShortName?.value ?? ''),
  };
}

export const wikimediaProvider: PhotoProvider = async (v, signal) => {
  if (v.latitude == null || v.longitude == null) return null;
  const candidates = await nearbyWithImage(v.latitude, v.longitude, signal);
  const hit = candidates.find((c) => c.file && c.label && namesMatch(v.name, c.label));
  if (!hit) return null;
  const info = await commonsInfo(hit.file, signal);
  if (!info) return null;
  const photo: VenuePhoto = {
    url: info.url,
    sourceUrl: info.sourceUrl,
    credit: [info.artist.slice(0, 60), info.license, 'Wikimedia Commons'].filter(Boolean).join(' · '),
    alt: `Foto di ${hit.label}`,
    provider: 'wikimedia',
    match: `Wikidata ${hit.qid}: “${hit.label}”, a ${hit.meters} m`,
  };
  return photo;
};
