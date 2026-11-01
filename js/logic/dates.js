// Dates « jour de jeu » au format YYYY-MM-DD, toujours en heure de Paris.
export const TIMEZONE = 'Europe/Paris';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Date du jour à Paris, quel que soit le fuseau du téléphone. */
export function todayParis(now = new Date()) {
  return fmt.format(now);
}

export function isISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))
    && new Date(s + 'T00:00:00Z').toISOString().startsWith(s);
}

const toUTC = (iso) => Date.parse(iso + 'T00:00:00Z');

export function addDays(iso, n) {
  return new Date(toUTC(iso) + n * 86400000).toISOString().slice(0, 10);
}

/** Nombre de jours de `a` à `b` (b − a). */
export function diffDays(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

/** Jour de la semaine (0 = dimanche … 6 = samedi). */
export function weekday(iso) {
  return new Date(toUTC(iso)).getUTCDay();
}

export function inRange(iso, from, to) {
  return (!from || iso >= from) && (!to || iso <= to);
}
