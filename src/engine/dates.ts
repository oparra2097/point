/**
 * Calendar-date helpers, shared so expiry logic cannot drift between callers.
 *
 * Everything here works in the device's LOCAL calendar, deliberately. Issuers
 * print expiry as a local date, so a user in UTC-8 shopping at 6pm on the 25th
 * must still see an offer that expires on the 25th. Mixing a UTC "today"
 * against a locally-parsed expiry retires offers a day early for everyone west
 * of Greenwich.
 */

/** The device's own calendar date as YYYY-MM-DD. */
export function localDateKey(d: Date = new Date()): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Whole calendar days from today until an ISO date; negative once past.
 *
 * Compares dates at midnight rather than measuring an end-of-day expiry
 * against the current clock time, which rounds "expires the 25th, today is the
 * 20th" up to 6 days. Rounding absorbs the 23- and 25-hour days either side of
 * a daylight-saving change.
 */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const expiry = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((expiry - today) / 86_400_000);
}

/** True when an offer with this expiry is still usable today. */
export function isLive(expiresAt: string | undefined, now: Date = new Date()): boolean {
  return !expiresAt || expiresAt >= localDateKey(now);
}
