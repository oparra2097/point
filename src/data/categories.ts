/**
 * Spend categories.
 *
 * These are the join between "where am I standing" and "what does my card pay
 * here". They deliberately mirror how issuers actually bucket spend (which is
 * driven by merchant category codes) rather than how a person would describe a
 * store, because the earn rules are written against the issuer's buckets.
 */

export type CategoryId =
  | 'dining'
  | 'groceries'
  | 'wholesale_clubs'
  | 'gas'
  | 'ev_charging'
  | 'transit'
  | 'flights'
  | 'hotels'
  | 'rental_cars'
  | 'travel_other'
  | 'streaming'
  | 'online_retail'
  | 'drugstores'
  | 'home_improvement'
  | 'entertainment'
  | 'department_stores'
  | 'utilities'
  | 'other';

export interface Category {
  id: CategoryId;
  label: string;
  /** SF Symbol / Material-ish glyph name, rendered via a vector icon set. */
  icon: string;
  /** Keywords used to guess a category from a raw merchant name. */
  keywords: string[];
}

export const CATEGORIES: Record<CategoryId, Category> = {
  dining: {
    id: 'dining',
    label: 'Dining',
    icon: 'silverware-fork-knife',
    keywords: [
      'restaurant', 'cafe', 'coffee', 'pizza', 'grill', 'kitchen', 'bar',
      'tavern', 'bistro', 'diner', 'bakery', 'sushi', 'taco', 'burger',
      'starbucks', 'chipotle', 'mcdonald', 'panera', 'dunkin', 'shake shack',
      'sweetgreen', 'doordash', 'uber eats', 'grubhub', 'seamless', 'postmates',
    ],
  },
  groceries: {
    id: 'groceries',
    label: 'Groceries',
    icon: 'cart',
    keywords: [
      'grocery', 'supermarket', 'market', 'foods', 'whole foods', 'trader joe',
      'kroger', 'safeway', 'publix', 'wegmans', 'albertsons', 'h-e-b', 'heb',
      'ralphs', 'vons', 'giant', 'stop & shop', 'food lion', 'sprouts', 'aldi',
    ],
  },
  wholesale_clubs: {
    id: 'wholesale_clubs',
    label: 'Wholesale club',
    icon: 'warehouse',
    keywords: ['costco', 'sam’s club', 'sams club', 'bj’s', 'bjs wholesale'],
  },
  gas: {
    id: 'gas',
    label: 'Gas',
    icon: 'gas-station',
    keywords: [
      'gas', 'fuel', 'shell', 'chevron', 'exxon', 'mobil', 'bp', 'texaco',
      'sunoco', 'citgo', 'arco', 'marathon', 'valero', 'wawa', 'sheetz',
    ],
  },
  ev_charging: {
    id: 'ev_charging',
    label: 'EV charging',
    icon: 'ev-station',
    keywords: ['supercharger', 'electrify america', 'chargepoint', 'evgo', 'ev charging'],
  },
  transit: {
    id: 'transit',
    label: 'Transit',
    icon: 'train',
    keywords: [
      'transit', 'metro', 'subway station', 'mta', 'bart', 'caltrain', 'amtrak',
      'uber', 'lyft', 'taxi', 'parking', 'toll',
    ],
  },
  flights: {
    id: 'flights',
    label: 'Flights',
    icon: 'airplane',
    keywords: [
      'airline', 'airways', 'air lines', 'delta', 'united', 'american airlines',
      'southwest', 'jetblue', 'alaska air', 'airport',
    ],
  },
  hotels: {
    id: 'hotels',
    label: 'Hotels',
    icon: 'bed',
    keywords: [
      'hotel', 'inn', 'resort', 'marriott', 'hilton', 'hyatt', 'ihg',
      'sheraton', 'westin', 'ritz', 'four seasons', 'airbnb', 'vrbo', 'motel',
    ],
  },
  rental_cars: {
    id: 'rental_cars',
    label: 'Rental cars',
    icon: 'car-key',
    keywords: ['hertz', 'avis', 'enterprise rent', 'national car', 'budget rent', 'sixt', 'car rental'],
  },
  travel_other: {
    id: 'travel_other',
    label: 'Travel',
    icon: 'bag-suitcase',
    keywords: ['cruise', 'travel agency', 'expedia', 'booking.com', 'priceline', 'kayak'],
  },
  streaming: {
    id: 'streaming',
    label: 'Streaming',
    icon: 'play-circle',
    keywords: [
      'netflix', 'hulu', 'disney+', 'disney plus', 'spotify', 'apple music',
      'hbo', 'max', 'peacock', 'paramount+', 'youtube tv', 'sling',
    ],
  },
  online_retail: {
    id: 'online_retail',
    label: 'Online retail',
    icon: 'package-variant',
    keywords: ['amazon', 'ebay', 'etsy', 'shopify', 'wayfair', 'chewy', 'temu', 'shein'],
  },
  drugstores: {
    id: 'drugstores',
    label: 'Drugstores',
    icon: 'pill',
    keywords: ['cvs', 'walgreens', 'rite aid', 'pharmacy', 'duane reade'],
  },
  home_improvement: {
    id: 'home_improvement',
    label: 'Home improvement',
    icon: 'hammer',
    keywords: ['home depot', 'lowe’s', 'lowes', 'ace hardware', 'menards', 'hardware'],
  },
  entertainment: {
    id: 'entertainment',
    label: 'Entertainment',
    icon: 'ticket',
    keywords: [
      'cinema', 'theatre', 'theater', 'amc', 'regal', 'cinemark', 'ticketmaster',
      'stubhub', 'concert', 'museum', 'stadium', 'arena',
    ],
  },
  department_stores: {
    id: 'department_stores',
    label: 'Department stores',
    icon: 'hanger',
    keywords: [
      'target', 'walmart', 'macy', 'nordstrom', 'kohl', 'jcpenney', 'dillard',
      'saks', 'bloomingdale', 'tj maxx', 'marshalls', 'ross',
    ],
  },
  utilities: {
    id: 'utilities',
    label: 'Utilities',
    icon: 'flash',
    keywords: ['electric', 'water bill', 'internet', 'comcast', 'xfinity', 'verizon', 'at&t', 't-mobile'],
  },
  other: { id: 'other', label: 'Everything else', icon: 'dots-horizontal', keywords: [] },
};

export const CATEGORY_LIST: Category[] = Object.values(CATEGORIES);

/**
 * Best-effort category guess from a raw merchant name.
 *
 * Longest keyword wins, so "whole foods" beats the bare "foods" and
 * "electrify america" beats "electric". Returns `other` when nothing matches,
 * which is the honest answer — the UI lets the user correct it, and that
 * correction is what we remember.
 */
export function guessCategory(merchantName: string): CategoryId {
  const name = merchantName.toLowerCase().trim();
  if (!name) return 'other';

  let best: { id: CategoryId; len: number } | null = null;
  for (const category of CATEGORY_LIST) {
    for (const keyword of category.keywords) {
      if (name.includes(keyword) && (!best || keyword.length > best.len)) {
        best = { id: category.id, len: keyword.length };
      }
    }
  }
  return best?.id ?? 'other';
}
