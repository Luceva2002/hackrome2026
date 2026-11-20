'use client';

import { createContext, useContext } from 'react';

/**
 * Modalità ospite: senza account si vedono mappa, ricerca e schede dei luoghi,
 * ma non l'assistente vocale né le pagine che scrivono (attività, profilo, gestore).
 * La scelta resta in un cookie, così anche le API dei luoghi la riconoscono.
 */
export const GUEST_COOKIE = 'sic_ospite';
const MAX_AGE = 60 * 60 * 24 * 30;

/** Pagine aperte all'ospite: la mappa (con filtri e schede) e la Home */
const GUEST_PATHS = ['/mappa', '/inizio'];

export function isGuestPath(pathname: string) {
  return pathname === '/' || GUEST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function hasGuestCookie() {
  return typeof document !== 'undefined' && document.cookie.split('; ').includes(`${GUEST_COOKIE}=1`);
}

export function enterGuest() {
  document.cookie = `${GUEST_COOKIE}=1; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}

export function leaveGuest() {
  if (hasGuestCookie()) document.cookie = `${GUEST_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Vero dentro l'app quando si naviga come ospite (lo imposta RequireAuth) */
export const GuestContext = createContext(false);

export const useIsGuest = () => useContext(GuestContext);
