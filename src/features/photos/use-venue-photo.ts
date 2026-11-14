'use client';

import { useEffect, useState } from 'react';

import type { PhotoProvider, PhotoQuery, VenuePhoto } from './types';
import { wikimediaProvider } from './wikidata';

/**
 * Catena dei fornitori di foto, in ordine di fiducia.
 * PUNTO DI AGGANCIO: Fabi può aggiungere qui un fornitore Exa (foto trovate sul
 * sito ufficiale del luogo, con URL della pagina come fonte) e in futuro le
 * foto caricate dal gestore verificato andranno in testa.
 */
export const PHOTO_PROVIDERS: PhotoProvider[] = [wikimediaProvider];

const CACHE_KEY = 'romaincampo:photos:v1';
const memory = new Map<string, VenuePhoto | null>();

function readCache(): Record<string, VenuePhoto | null> {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function writeCache(id: string, p: VenuePhoto | null) {
  try {
    const all = readCache();
    all[id] = p;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    // storage non disponibile: resta la cache in memoria
  }
}

// Massimo 3 ricerche insieme: le card della Home sono tante
let running = 0;
const queue: (() => void)[] = [];
const slot = () =>
  new Promise<() => void>((resolve) => {
    const go = () => {
      running++;
      resolve(() => {
        running--;
        queue.shift()?.();
      });
    };
    if (running < 3) go();
    else queue.push(go);
  });

export async function findVenuePhoto(v: PhotoQuery, signal?: AbortSignal): Promise<VenuePhoto | null> {
  if (memory.has(v.id)) return memory.get(v.id)!;
  const cached = readCache();
  if (v.id in cached) {
    memory.set(v.id, cached[v.id]);
    return cached[v.id];
  }
  const release = await slot();
  let failed = false;
  try {
    for (const provider of PHOTO_PROVIDERS) {
      try {
        const p = await provider(v, signal);
        if (p) {
          memory.set(v.id, p);
          writeCache(v.id, p);
          return p;
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
        // fornitore non raggiungibile: si prova il prossimo, senza salvare il "nessuna foto"
        failed = true;
      }
    }
    if (failed) return null;
    memory.set(v.id, null);
    writeCache(v.id, null);
    return null;
  } finally {
    release();
  }
}

export function useVenuePhoto(v: PhotoQuery | null) {
  const [photo, setPhoto] = useState<VenuePhoto | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  useEffect(() => {
    if (!v) return;
    const ctrl = new AbortController();
    setPhoto(memory.get(v.id) ?? null);
    setState(memory.has(v.id) ? 'done' : 'loading');
    findVenuePhoto(v, ctrl.signal)
      .then((p) => {
        setPhoto(p);
        setState('done');
      })
      .catch(() => setState('done'));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.id]);

  return { photo, loading: state === 'loading' };
}
