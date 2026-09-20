/**
 * Parse issuer offer text into structured terms.
 *
 * Input is whatever we can legitimately get our hands on: OCR output from a
 * screenshot the user took of their own issuer app, the body of a forwarded
 * offer email, or text they pasted. Every issuer phrases the same economics
 * differently, and two of the phrasings state their numbers in the opposite
 * order from each other:
 *
 *   Amex     "Spend $100 or more, get $25 back"   -> min 100, back 25
 *   Chase    "$5 back on $25+"                    -> min 25,  back 5
 *
 * So the grammar decides which number is which. Never the magnitude — a
 * "$50 back on $50" promo is rare but real, and size-based guessing inverts it.
 */

import { normalizeMerchant } from './merchant';

export type OfferKind = 'spend_get' | 'percent' | 'points' | 'unknown';

export interface ParsedOffer {
  kind: OfferKind;
  merchant: string;
  /** Minimum qualifying spend, if the offer has a threshold. */
  minSpend?: number;
  /** Flat dollars back once the threshold is met. */
  amountBack?: number;
  /** Percent back, as a whole number: 10 means 10%. */
  percentBack?: number;
  /** Cap on a percent offer's payout. */
  maxBack?: number;
  /** Points or miles awarded, for point-denominated offers. */
  pointsBack?: number;
  /** ISO date (YYYY-MM-DD). */
  expiresAt?: string;
  raw: string;
  /** 0-1. Below ~0.5 the UI should ask the user to confirm before saving. */
  confidence: number;
}

/** Strip trademark noise and unicode punctuation that OCR loves to emit. */
function clean(text: string): string {
  return text
    .replace(/[®™℠]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[＄]/g, '$')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "$1,234.56" / "1,234" -> 1234.56. Returns NaN on garbage. */
function money(s: string): number {
  return parseFloat(s.replace(/[$,\s]/g, ''));
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Pull an expiry date out of offer text.
 *
 * Bare "12/31" with no year is read as the next occurrence of that date, not
 * the current year, so an offer scanned in December for a January deadline
 * doesn't land in the past and get filtered out as already expired.
 */
export function parseExpiry(text: string, now: Date = new Date()): string | undefined {
  const t = clean(text).toLowerCase();

  const numeric = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numeric) {
    const month = parseInt(numeric[1], 10);
    const day = parseInt(numeric[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      if (numeric[3]) {
        let year = parseInt(numeric[3], 10);
        if (year < 100) year += 2000;
        return iso(year, month, day);
      }
      const thisYear = now.getFullYear();
      const candidate = new Date(thisYear, month - 1, day, 23, 59, 59);
      return iso(candidate < now ? thisYear + 1 : thisYear, month, day);
    }
  }

  const named = t.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:(?:st|nd|rd|th))?(?:,?\s*(\d{4}))?/,
  );
  if (named) {
    const month = MONTHS[named[1]];
    const day = parseInt(named[2], 10);
    if (named[3]) return iso(parseInt(named[3], 10), month, day);
    const thisYear = now.getFullYear();
    const candidate = new Date(thisYear, month - 1, day, 23, 59, 59);
    return iso(candidate < now ? thisYear + 1 : thisYear, month, day);
  }

  const relative = t.match(/expires?\s+in\s+(\d+)\s+day/);
  if (relative) {
    const d = new Date(now);
    d.setDate(d.getDate() + parseInt(relative[1], 10));
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  return undefined;
}

const NUM = '(\\$?[\\d,]+(?:\\.\\d{1,2})?)';

/**
 * Terms patterns, tried in order. The first match wins, so the more specific
 * pattern must come first: a percent-with-cap offer also matches the bare
 * percent pattern, and a points offer also matches spend-get.
 */
const PATTERNS: Array<{
  kind: OfferKind;
  re: RegExp;
  apply: (m: RegExpMatchArray, out: ParsedOffer) => void;
  confidence: number;
}> = [
  // "Spend $200 or more, get 5,000 Membership Rewards points"
  {
    kind: 'points',
    confidence: 0.95,
    re: new RegExp(`spend\\s+${NUM}[^.]*?\\bget\\s+([\\d,]+)\\s*(?:bonus\\s+)?(?:membership rewards|ultimate rewards|thankyou|bonus)?\\s*(?:points|miles)`, 'i'),
    apply: (m, o) => {
      o.minSpend = money(m[1]);
      o.pointsBack = money(m[2]);
    },
  },
  // "Get 5,000 points on a $200 purchase"
  {
    kind: 'points',
    confidence: 0.85,
    re: new RegExp(`\\b(?:get|earn)\\s+([\\d,]+)\\s*(?:points|miles)[^.]*?${NUM}`, 'i'),
    apply: (m, o) => {
      o.pointsBack = money(m[1]);
      o.minSpend = money(m[2]);
    },
  },
  // "Get 10% back on purchases, up to a total of $30"
  {
    kind: 'percent',
    confidence: 0.95,
    re: new RegExp(`([\\d.]+)\\s*%\\s*(?:cash\\s*)?(?:back|off)[^.]*?up\\s+to(?:\\s+a\\s+total\\s+of)?\\s*${NUM}`, 'i'),
    apply: (m, o) => {
      o.percentBack = parseFloat(m[1]);
      o.maxBack = money(m[2]);
    },
  },
  // "Spend $100 or more, get $25 back"  (spend stated first)
  {
    kind: 'spend_get',
    confidence: 0.95,
    re: new RegExp(`spend\\s+${NUM}[^.]*?\\bget\\s+${NUM}`, 'i'),
    apply: (m, o) => {
      o.minSpend = money(m[1]);
      o.amountBack = money(m[2]);
    },
  },
  // "$5 back on $25+"  /  "$10 off $50"  /  "$50 back on your first purchase of $250 or more"
  {
    kind: 'spend_get',
    confidence: 0.9,
    re: new RegExp(`${NUM}\\s*(?:cash\\s*)?(?:back|off)\\s+(?:on\\s+)?(?:your\\s+)?(?:first\\s+)?(?:purchases?\\s+)?(?:of\\s+)?${NUM}`, 'i'),
    apply: (m, o) => {
      o.amountBack = money(m[1]);
      o.minSpend = money(m[2]);
    },
  },
  // "10% cash back"  /  "5% off"
  {
    kind: 'percent',
    confidence: 0.85,
    re: /([\d.]+)\s*%\s*(?:cash\s*)?(?:back|off)/i,
    apply: (m, o) => {
      o.percentBack = parseFloat(m[1]);
    },
  },
  // "$25 back" with no stated threshold
  {
    kind: 'spend_get',
    confidence: 0.6,
    re: new RegExp(`${NUM}\\s*(?:cash\\s*)?(?:back|off|statement credit)`, 'i'),
    apply: (m, o) => {
      o.amountBack = money(m[1]);
    },
  },
];

/**
 * Parse a single offer's text. `merchantHint` is used when the merchant name
 * arrived out of band — as the heading line of a screenshot block, say.
 */
export function parseOffer(
  text: string,
  merchantHint = '',
  now: Date = new Date(),
): ParsedOffer {
  const raw = (text || '').trim();
  const t = clean(raw);

  const out: ParsedOffer = {
    kind: 'unknown',
    merchant: normalizeMerchant(merchantHint) || '',
    raw,
    confidence: 0,
  };

  for (const p of PATTERNS) {
    const m = t.match(p.re);
    if (m) {
      out.kind = p.kind;
      p.apply(m, out);
      out.confidence = p.confidence;
      break;
    }
  }

  const expiry = parseExpiry(t, now);
  if (expiry) out.expiresAt = expiry;

  if (!out.merchant) {
    out.merchant = normalizeMerchant(guessMerchantFromText(t));
    if (out.merchant) out.confidence = Math.min(out.confidence, 0.55);
  }

  // A threshold below the payout is a parse inversion, not a real offer.
  if (
    out.kind === 'spend_get' &&
    out.minSpend !== undefined &&
    out.amountBack !== undefined &&
    out.amountBack > out.minSpend
  ) {
    out.confidence = Math.min(out.confidence, 0.4);
  }

  if (!out.merchant) out.confidence = Math.min(out.confidence, 0.3);

  return out;
}

/** Last resort: take the leading words before any offer language starts. */
function guessMerchantFromText(t: string): string {
  const cut = t.split(/\b(?:spend|get|earn|save|up to|\d+\s*%|\$)/i)[0];
  return cut.trim().slice(0, 40);
}

/**
 * Split a full screen of OCR text into per-offer blocks and parse each.
 *
 * Issuer offer lists render as a stack of tiles, and OCR flattens them into
 * lines. A line with no money, no percent, and no offer verb is almost always
 * a merchant heading, so it opens a new block.
 */
export function parseOfferScreen(screenText: string, now: Date = new Date()): ParsedOffer[] {
  const lines = (screenText || '')
    .split(/[\r\n]+/)
    .map((l) => clean(l))
    .filter((l) => l.length > 0);

  const isHeading = (line: string): boolean =>
    !/[$%]/.test(line) &&
    !/\b(spend|get|earn|back|off|expires?|valid|ends|added|activate)\b/i.test(line) &&
    line.length <= 40;

  const blocks: Array<{ heading: string; body: string[] }> = [];
  for (const line of lines) {
    if (isHeading(line) || blocks.length === 0) {
      blocks.push({ heading: isHeading(line) ? line : '', body: isHeading(line) ? [] : [line] });
    } else {
      blocks[blocks.length - 1].body.push(line);
    }
  }

  return blocks
    .filter((b) => b.body.length > 0)
    .map((b) => parseOffer(b.body.join(' '), b.heading, now))
    .filter((o) => o.kind !== 'unknown');
}
