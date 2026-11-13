/** Date e orari sempre nel fuso di Roma, anche se il server gira in UTC. */
export const ROME_TZ = 'Europe/Rome';

function romeParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: ROME_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    min: Number(p.minute),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday),
  };
}

/** Offset di Roma rispetto a UTC (in minuti) in un dato istante */
function romeOffsetMinutes(d: Date) {
  const p = romeParts(d);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  return Math.round((asUtc - d.getTime()) / 60000);
}

/** Istante UTC corrispondente a una data/ora "da orologio" di Roma */
export function romeWallToDate(y: number, m: number, d: number, h = 0, min = 0): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  return new Date(guess.getTime() - romeOffsetMinutes(guess) * 60000);
}

export function romeHour(iso: string | Date) {
  return romeParts(new Date(iso)).h;
}

/** Inizio del giorno (a Roma) tra `offset` giorni */
export function romeDayStart(offset = 0, now = new Date()): Date {
  const p = romeParts(now);
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + offset));
  return romeWallToDate(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

export type WhenFilter = 'oggi' | 'domani' | 'weekend' | 'settimana';

export function whenRange(when: WhenFilter, now = new Date()): { from: Date; to: Date } {
  if (when === 'oggi') return { from: now, to: romeDayStart(1, now) };
  if (when === 'domani') return { from: romeDayStart(1, now), to: romeDayStart(2, now) };
  if (when === 'settimana') return { from: now, to: romeDayStart(7, now) };
  // weekend: da sabato 00:00 (o da adesso, se è già weekend) a lunedì 00:00
  const wd = romeParts(now).weekday;
  const toSat = wd === 6 || wd === 0 ? 0 : 6 - wd;
  const toMon = wd === 0 ? 1 : wd === 6 ? 2 : 8 - wd;
  return { from: toSat === 0 ? now : romeDayStart(toSat, now), to: romeDayStart(toMon, now) };
}

export type DaypartFilter = 'mattina' | 'pomeriggio' | 'sera';

export function daypartOf(iso: string): DaypartFilter {
  const h = romeHour(iso);
  return h < 13 ? 'mattina' : h < 18 ? 'pomeriggio' : 'sera';
}

const dateFmt = new Intl.DateTimeFormat('it-IT', { timeZone: ROME_TZ, weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('it-IT', { timeZone: ROME_TZ, hour: '2-digit', minute: '2-digit' });

export function formatDay(iso: string, now = new Date()) {
  const start = new Date(iso);
  if (start >= romeDayStart(0, now) && start < romeDayStart(1, now)) return 'Oggi';
  if (start >= romeDayStart(1, now) && start < romeDayStart(2, now)) return 'Domani';
  const s = dateFmt.format(start);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatTime(iso: string) {
  return timeFmt.format(new Date(iso));
}

/** "Oggi, 19:00–20:30" */
export function formatSlot(startIso: string, endIso?: string | null) {
  return `${formatDay(startIso)}, ${formatTime(startIso)}${endIso ? `–${formatTime(endIso)}` : ''}`;
}
