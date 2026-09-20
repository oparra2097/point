/**
 * Curated card benefits catalog.
 *
 * IMPORTANT: issuers change earn rates, credits and annual fees continuously,
 * and a stale rate here produces confidently wrong dollar figures — which is
 * worse than showing nothing. Every card carries an `asOf` date, the UI should
 * surface it, and these entries must be verified against issuer terms before
 * any public release. Treat this file as a seed for the engine, not as truth.
 */

import type { CategoryId } from './categories';
import type { CurrencyId } from './currencies';

export type Issuer = 'amex' | 'chase' | 'capital_one' | 'citi' | 'bofa' | 'discover' | 'wells_fargo';

export interface EarnRule {
  /** Categories this rate applies to, or 'all' for the catch-all rate. */
  categories: CategoryId[] | 'all';
  /** Points (or percent, for cash-back cards) per dollar. */
  rate: number;
  /** Annual spend cap after which the rate drops to the card's base rate. */
  capPerYear?: number;
  /** Rate only applies when booked through the issuer's own travel portal. */
  viaPortal?: boolean;
  note?: string;
}

export interface Credit {
  id: string;
  label: string;
  /** Dollars per period. */
  amount: number;
  period: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  /** Merchants that trigger it, matched through the merchant matcher. */
  merchants?: string[];
  categories?: CategoryId[];
}

export interface CardSpec {
  id: string;
  issuer: Issuer;
  name: string;
  currency: CurrencyId;
  annualFee: number;
  /** Card face gradient. */
  colors: [string, string];
  earn: EarnRule[];
  credits: Credit[];
  /** ISO date these terms were last verified. */
  asOf: string;
}

const ASOF = '2026-01-01';

export const CARD_CATALOG: CardSpec[] = [
  {
    id: 'amex_gold',
    issuer: 'amex',
    name: 'American Express Gold',
    currency: 'amex_mr',
    annualFee: 325,
    colors: ['#C6A961', '#8A7433'],
    asOf: ASOF,
    earn: [
      { categories: ['dining'], rate: 4, capPerYear: 50000 },
      { categories: ['groceries'], rate: 4, capPerYear: 25000, note: 'U.S. supermarkets' },
      { categories: ['flights'], rate: 3, note: 'Booked direct with the airline' },
      { categories: 'all', rate: 1 },
    ],
    credits: [
      { id: 'gold_uber', label: 'Uber Cash', amount: 10, period: 'monthly', merchants: ['uber', 'uber eats'] },
      { id: 'gold_dining', label: 'Dining credit', amount: 10, period: 'monthly', categories: ['dining'] },
    ],
  },
  {
    id: 'amex_platinum',
    issuer: 'amex',
    name: 'American Express Platinum',
    currency: 'amex_mr',
    annualFee: 695,
    colors: ['#B9BDC4', '#7D838B'],
    asOf: ASOF,
    earn: [
      { categories: ['flights'], rate: 5, note: 'Booked direct or through Amex Travel' },
      { categories: ['hotels'], rate: 5, viaPortal: true },
      { categories: 'all', rate: 1 },
    ],
    credits: [
      { id: 'plat_digital', label: 'Digital entertainment', amount: 20, period: 'monthly', categories: ['streaming'] },
      { id: 'plat_uber', label: 'Uber Cash', amount: 15, period: 'monthly', merchants: ['uber', 'uber eats'] },
      { id: 'plat_airline', label: 'Airline fee credit', amount: 200, period: 'annual', categories: ['flights'] },
      { id: 'plat_hotel', label: 'Hotel credit', amount: 200, period: 'annual', categories: ['hotels'] },
    ],
  },
  {
    id: 'amex_bcp',
    issuer: 'amex',
    name: 'Blue Cash Preferred',
    currency: 'cash',
    annualFee: 95,
    colors: ['#2E6FD6', '#1B4890'],
    asOf: ASOF,
    earn: [
      { categories: ['groceries'], rate: 6, capPerYear: 6000, note: 'U.S. supermarkets' },
      { categories: ['streaming'], rate: 6 },
      { categories: ['transit'], rate: 3 },
      { categories: ['gas'], rate: 3 },
      { categories: 'all', rate: 1 },
    ],
    credits: [],
  },
  {
    id: 'chase_csp',
    issuer: 'chase',
    name: 'Chase Sapphire Preferred',
    currency: 'chase_ur',
    annualFee: 95,
    colors: ['#1B4E8C', '#0E2F58'],
    asOf: ASOF,
    earn: [
      { categories: ['flights', 'hotels', 'rental_cars', 'travel_other'], rate: 5, viaPortal: true },
      { categories: ['dining'], rate: 3 },
      { categories: ['streaming'], rate: 3 },
      { categories: ['flights', 'hotels', 'travel_other'], rate: 2 },
      { categories: 'all', rate: 1 },
    ],
    credits: [{ id: 'csp_hotel', label: 'Hotel credit', amount: 50, period: 'annual', categories: ['hotels'] }],
  },
  {
    id: 'chase_freedom_unlimited',
    issuer: 'chase',
    name: 'Chase Freedom Unlimited',
    currency: 'chase_ur',
    annualFee: 0,
    colors: ['#2D7DD2', '#17537F'],
    asOf: ASOF,
    earn: [
      { categories: ['dining'], rate: 3 },
      { categories: ['drugstores'], rate: 3 },
      { categories: 'all', rate: 1.5 },
    ],
    credits: [],
  },
  {
    id: 'capone_savor',
    issuer: 'capital_one',
    name: 'Capital One Savor',
    currency: 'cash',
    annualFee: 0,
    colors: ['#D03027', '#8E1F19'],
    asOf: ASOF,
    earn: [
      { categories: ['dining'], rate: 3 },
      { categories: ['entertainment'], rate: 3 },
      { categories: ['streaming'], rate: 3 },
      { categories: ['groceries'], rate: 3 },
      { categories: 'all', rate: 1 },
    ],
    credits: [],
  },
  {
    id: 'capone_venture_x',
    issuer: 'capital_one',
    name: 'Capital One Venture X',
    currency: 'capone_miles',
    annualFee: 395,
    colors: ['#1F2A37', '#0B1220'],
    asOf: ASOF,
    earn: [
      { categories: ['hotels', 'rental_cars'], rate: 10, viaPortal: true },
      { categories: ['flights'], rate: 5, viaPortal: true },
      { categories: 'all', rate: 2 },
    ],
    credits: [
      { id: 'vx_travel', label: 'Travel credit', amount: 300, period: 'annual', categories: ['flights', 'hotels', 'travel_other'] },
    ],
  },
  {
    id: 'citi_custom_cash',
    issuer: 'citi',
    name: 'Citi Custom Cash',
    currency: 'citi_ty',
    annualFee: 0,
    colors: ['#1B5FAA', '#0E3A6B'],
    asOf: ASOF,
    earn: [
      {
        categories: ['dining', 'groceries', 'gas', 'transit', 'streaming', 'drugstores', 'entertainment', 'home_improvement'],
        rate: 5,
        capPerYear: 6000,
        note: 'Top eligible category each billing cycle only',
      },
      { categories: 'all', rate: 1 },
    ],
    credits: [],
  },
];

export const CARDS_BY_ID: Record<string, CardSpec> = Object.fromEntries(
  CARD_CATALOG.map((c) => [c.id, c]),
);

/** Annualized dollar value of a card's credits, at face value. */
export function creditsPerYear(card: CardSpec): number {
  const multiplier = { monthly: 12, quarterly: 4, semiannual: 2, annual: 1 } as const;
  return card.credits.reduce((sum, c) => sum + c.amount * multiplier[c.period], 0);
}
