/**
 * Merchant identity across issuers.
 *
 * The same store shows up under wildly different strings depending on who is
 * describing it. Amex might say "SQ *SWEETGREEN #1234", Chase "sweetgreen.com",
 * Capital One just "Sweetgreen", and an OCR pass over a screenshot might hand
 * us "Sweetgneen" because the lowercase g and n blurred together.
 *
 * Every one of those has to collapse to one merchant, or cross-card offer
 * aggregation quietly does nothing — which is the entire product. So this is
 * deliberately the most defensive module in the codebase.
 */

/**
 * Payment-processor and gateway prefixes that ride along on descriptors.
 * These are matched at the start of the string only.
 */
const PROCESSOR_PREFIXES = [
  'sq *', 'sq*', 'tst*', 'tst *', 'toast*', 'paypal *', 'paypal*', 'pp*', 'pp *',
  'sp *', 'sp*', 'sumup *', 'clover *', 'venmo *', 'stripe *', 'shopify *',
  'wpy*', 'wp *', 'ebay o*', 'amzn mktp', 'amazon mktpl',
];

/** Corporate-form noise that never distinguishes one brand from another. */
const SUFFIX_NOISE = [
  'inc', 'llc', 'l l c', 'ltd', 'co', 'corp', 'company', 'holdings',
  'usa', 'us', 'stores', 'store', 'online', 'shop',
];

/**
 * Canonical brand aliases.
 *
 * Maps a normalized variant to the canonical brand key. Only needed where
 * mechanical normalization can't get there — abbreviations, renames, and
 * sub-brands that should rank as one merchant.
 */
const ALIASES: Record<string, string> = {
  'thehomedepot': 'home depot',
  'homedepot': 'home depot',
  'hd': 'home depot',
  'bestbuy': 'best buy',
  'wholefoods': 'whole foods',
  'wholefoodsmkt': 'whole foods',
  'wfm': 'whole foods',
  'traderjoes': 'trader joes',
  'tjs': 'trader joes',
  'cvspharmacy': 'cvs',
  'cvs pharmacy': 'cvs',
  'walgreen': 'walgreens',
  'mcdonalds': 'mcdonald s',
  'ubereats': 'uber eats',
  'uber trip': 'uber',
  'uber eats': 'uber eats',
  'lyft ride': 'lyft',
  'dd doordash': 'doordash',
  'doordashdashpass': 'doordash',
  'amzn': 'amazon',
  'amazonmktpl': 'amazon',
  'amazonprime': 'amazon',
  'nike com': 'nike',
  'adidas com': 'adidas',
  'starbucksstore': 'starbucks',
  'sbux': 'starbucks',
  'dunkindonuts': 'dunkin',
  'chickfila': 'chick fil a',
  'chick fil a': 'chick fil a',
  'panerabread': 'panera',
  'shakeshack': 'shake shack',
  'sweetgreens': 'sweetgreen',
  'tjmaxx': 'tj maxx',
  't j maxx': 'tj maxx',
  'samsclub': 'sams club',
  'bjswholesale': 'bjs',
  'deltaairlines': 'delta',
  'delta air lines': 'delta',
  'unitedairlines': 'united',
  'americanairlines': 'american airlines',
  'aa com': 'american airlines',
  'southwestairlines': 'southwest',
  'marriottbonvoy': 'marriott',
  'hiltonhotels': 'hilton',
  'hyatthotels': 'hyatt',
};

/**
 * Reduce a raw merchant descriptor to a comparable key.
 *
 * Order matters here: processor prefixes come off before punctuation, because
 * the "*" is the only thing marking them; store numbers come off before
 * trailing-token cleanup, so "#1234" doesn't survive as a bare "1234".
 */
export function normalizeMerchant(raw: string): string {
  let s = (raw || '').toLowerCase().trim();
  if (!s) return '';

  for (const prefix of PROCESSOR_PREFIXES) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length).trim();
      break;
    }
  }

  s = s.replace(/^www\./, '');
  s = s.replace(/\.(com|net|org|co|io|shop|store)\b/g, ' ');

  // Store / location numbers: "#1234", "store 45", and trailing bare numbers.
  s = s.replace(/#\s*\d+/g, ' ');
  s = s.replace(/\bstore\s+\d+\b/g, ' ');
  s = s.replace(/\s+\d{3,}\s*$/g, ' ');

  s = s.replace(/&/g, ' and ');
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  let tokens = s.split(' ').filter(Boolean);
  while (tokens.length > 1 && SUFFIX_NOISE.includes(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  if (tokens.length > 1 && tokens[0] === 'the') tokens.shift();

  s = tokens.join(' ');

  const collapsed = s.replace(/\s/g, '');
  if (ALIASES[collapsed]) return ALIASES[collapsed];
  if (ALIASES[s]) return ALIASES[s];

  return s;
}

/**
 * Dice coefficient over character bigrams, in [0, 1].
 *
 * Chosen over edit distance because it degrades gracefully on the failure mode
 * we actually see: OCR mangling a character or two in the middle of a word.
 * "sweetgreen" vs "sweetgneen" scores ~0.78 here, where a naive equality check
 * scores 0 and drops the offer on the floor.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const ba = bigrams(a);
  const bb = bigrams(b);
  let overlap = 0;
  let total = 0;
  for (const n of ba.values()) total += n;
  for (const n of bb.values()) total += n;
  for (const [g, n] of ba) overlap += Math.min(n, bb.get(g) ?? 0);

  return (2 * overlap) / total;
}

/**
 * Tokens that turn a parent brand into a genuinely different merchant.
 *
 * "uber" and "uber eats" are not the same place: they sit in different spend
 * categories and carry different offers, so an Uber Eats offer must never fire
 * on a ride. Containment matching is suppressed when the extra tokens include
 * one of these.
 */
const DISTINCT_QUALIFIERS = new Set([
  'eats', 'fresh', 'express', 'plus', 'go', 'pay', 'prime', 'market',
  'gas', 'fuel', 'travel', 'rewards', 'wholesale', 'outlet', 'liquor',
]);

/**
 * Levenshtein distance, abandoned once it exceeds `max`.
 *
 * Only ever called with max = 1, so the early exit keeps it effectively linear.
 */
function editDistanceWithin(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      rowBest = Math.min(rowBest, curr[j]);
    }
    if (rowBest > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/** Above this, two normalized names are treated as the same merchant. */
export const MATCH_THRESHOLD = 0.82;

export interface MerchantMatch {
  matches: boolean;
  score: number;
  /** True when the two strings normalized to exactly the same key. */
  exact: boolean;
}

/**
 * Decide whether two raw merchant descriptors refer to the same place.
 *
 * Three tiers, strongest first:
 *
 *  1. Exact match on the normalized key.
 *  2. Token containment — "sweetgreen" inside "sweetgreen downtown crossing"
 *     is the same store. Guarded two ways: the shared token must be at least
 *     four characters, so a short token like "bp" does not match "bpm fitness";
 *     and the extra tokens must not be brand-forming (see DISTINCT_QUALIFIERS).
 *  3. Fuzzy, for OCR damage. A single mangled character is the common failure
 *     — "sweetgneen" for "sweetgreen" — and it only scores ~0.78 on bigram
 *     overlap, under the threshold. So an explicit edit-distance-1 tier catches
 *     it, with a five-character floor so short names are not merged by it.
 */
export function matchMerchant(a: string, b: string): MerchantMatch {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);

  if (!na || !nb) return { matches: false, score: 0, exact: false };
  if (na === nb) return { matches: true, score: 1, exact: true };

  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];

  const shortTokens = new Set(shorter.split(' '));
  const extraTokens = longer.split(' ').filter((t) => !shortTokens.has(t));
  const brandShift = extraTokens.some((t) => DISTINCT_QUALIFIERS.has(t));

  if (!brandShift && shorter.length >= 4 && longer.includes(shorter)) {
    return { matches: true, score: 0.95, exact: false };
  }

  if (!brandShift && shorter.length >= 5 && editDistanceWithin(na, nb, 1) <= 1) {
    return { matches: true, score: 0.9, exact: false };
  }

  const score = similarity(na, nb);
  return { matches: !brandShift && score >= MATCH_THRESHOLD, score, exact: false };
}

/** Pick the best match for `needle` among `haystack`, or null if none clear the bar. */
export function bestMatch<T>(
  needle: string,
  haystack: T[],
  nameOf: (item: T) => string,
): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;
  for (const item of haystack) {
    const { matches, score } = matchMerchant(needle, nameOf(item));
    if (matches && (!best || score > best.score)) best = { item, score };
  }
  return best;
}

/** Title-case a normalized key for display: "shake shack" -> "Shake Shack". */
export function displayMerchant(raw: string): string {
  const n = normalizeMerchant(raw);
  if (!n) return raw.trim();
  return n.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
