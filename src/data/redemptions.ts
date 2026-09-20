/**
 * How points can actually be spent, and what each route is worth.
 *
 * This is the half of a rewards app that usually goes missing. Showing someone
 * they hold 184,500 Membership Rewards is not useful on its own, because the
 * same balance is worth $1,107 or $9,225 depending entirely on how it is
 * redeemed -- and the easiest route is very often the worst one. The spread
 * between the default and the best option is the single largest decision in
 * most people's rewards portfolio, and nothing surfaces it.
 *
 * VALUES ARE RANGES, NOT QUOTES. Fixed routes (cash out, portal booking) are
 * contractual and stable. Transfer routes depend on what you book, and every
 * major program now prices awards dynamically, so a single number would be
 * false precision. Ranges are the honest representation.
 *
 * TRANSFER PARTNERS CHANGE. Programs add and drop partners with little notice
 * and ratios get devalued. Verify against the issuer before relying on any of
 * this; `PARTNERS_AS_OF` records when this snapshot was taken.
 */

import type { CurrencyId } from './currencies';

export const PARTNERS_AS_OF = '2026-01-01';

export type RouteType = 'cash' | 'portal' | 'transfer' | 'giftcard' | 'merchandise';

/** How much work a route costs the user, which is real and worth surfacing. */
export type Effort = 'instant' | 'easy' | 'work';

export interface CppRange {
  low: number;
  typical: number;
  high: number;
}

export interface RedemptionRoute {
  id: string;
  currencyId: CurrencyId;
  label: string;
  type: RouteType;
  cpp: CppRange;
  effort: Effort;
  note?: string;
}

export interface TransferPartner {
  name: string;
  kind: 'airline' | 'hotel';
  /**
   * Partner points received per point transferred. 1 is 1:1; Hilton's 2 means
   * one Membership Rewards point becomes two Hilton points -- which sounds
   * generous and is not, because Hilton points are worth far less.
   */
  ratio: number;
}

const fixed = (low: number, typical = low, high = typical): CppRange => ({ low, typical, high });

export const REDEMPTION_ROUTES: RedemptionRoute[] = [
  // --- American Express Membership Rewards ---
  {
    id: 'mr_statement', currencyId: 'amex_mr', label: 'Statement credit', type: 'cash',
    cpp: fixed(0.6), effort: 'instant',
    note: 'The worst common use of Membership Rewards, and the one the app pushes hardest.',
  },
  {
    id: 'mr_checkout', currencyId: 'amex_mr', label: 'Pay with points at checkout', type: 'merchandise',
    cpp: fixed(0.7), effort: 'instant', note: 'Amazon, PayPal and similar partners.',
  },
  {
    id: 'mr_gift', currencyId: 'amex_mr', label: 'Gift cards', type: 'giftcard',
    cpp: fixed(1.0), effort: 'easy',
  },
  {
    id: 'mr_travel', currencyId: 'amex_mr', label: 'Book flights on Amex Travel', type: 'portal',
    cpp: fixed(1.0), effort: 'easy',
  },
  {
    id: 'mr_transfer', currencyId: 'amex_mr', label: 'Transfer to an airline or hotel', type: 'transfer',
    cpp: { low: 1.5, typical: 2.0, high: 5.0 }, effort: 'work',
    note: 'Best value by a wide margin, especially for long-haul premium cabins.',
  },

  // --- Chase Ultimate Rewards ---
  {
    id: 'ur_cash', currencyId: 'chase_ur', label: 'Cash back', type: 'cash',
    cpp: fixed(1.0), effort: 'instant',
  },
  {
    id: 'ur_portal', currencyId: 'chase_ur', label: 'Book through Chase Travel', type: 'portal',
    cpp: { low: 1.0, typical: 1.25, high: 1.5 }, effort: 'easy',
    note: 'The multiplier depends on which Sapphire card you hold.',
  },
  {
    id: 'ur_transfer', currencyId: 'chase_ur', label: 'Transfer to an airline or hotel', type: 'transfer',
    cpp: { low: 1.5, typical: 2.05, high: 4.0 }, effort: 'work',
    note: 'Hyatt is the standout: modest point prices against high cash rates.',
  },

  // --- Citi ThankYou ---
  {
    id: 'ty_cash', currencyId: 'citi_ty', label: 'Cash back', type: 'cash',
    cpp: fixed(1.0), effort: 'instant',
  },
  {
    id: 'ty_portal', currencyId: 'citi_ty', label: 'Book through Citi Travel', type: 'portal',
    cpp: fixed(1.0), effort: 'easy',
  },
  {
    id: 'ty_transfer', currencyId: 'citi_ty', label: 'Transfer to an airline or hotel', type: 'transfer',
    cpp: { low: 1.4, typical: 1.8, high: 3.5 }, effort: 'work',
  },

  // --- Capital One miles ---
  {
    id: 'c1_cash', currencyId: 'capone_miles', label: 'Cash back', type: 'cash',
    cpp: fixed(0.5), effort: 'instant',
    note: 'Capital One miles cash out at half a cent -- half what a travel redemption gives.',
  },
  {
    id: 'c1_eraser', currencyId: 'capone_miles', label: 'Erase a travel purchase', type: 'portal',
    cpp: fixed(1.0), effort: 'easy',
  },
  {
    id: 'c1_transfer', currencyId: 'capone_miles', label: 'Transfer to an airline or hotel', type: 'transfer',
    cpp: { low: 1.3, typical: 1.7, high: 3.0 }, effort: 'work',
  },

  // --- Bilt ---
  {
    id: 'bilt_transfer', currencyId: 'bilt', label: 'Transfer to an airline or hotel', type: 'transfer',
    cpp: { low: 1.5, typical: 2.05, high: 4.0 }, effort: 'work',
  },
  {
    id: 'bilt_portal', currencyId: 'bilt', label: 'Book travel through Bilt', type: 'portal',
    cpp: fixed(1.25), effort: 'easy',
  },

  // --- Hotel programs (no transfer out; these are terminal currencies) ---
  {
    id: 'marriott_award', currencyId: 'marriott', label: 'Award night', type: 'portal',
    cpp: { low: 0.5, typical: 0.7, high: 1.2 }, effort: 'easy',
  },
  {
    id: 'hilton_award', currencyId: 'hilton', label: 'Award night', type: 'portal',
    cpp: { low: 0.3, typical: 0.5, high: 0.8 }, effort: 'easy',
    note: 'Hilton points are numerous and individually cheap; large balances are normal.',
  },
  {
    id: 'hyatt_award', currencyId: 'hyatt', label: 'Award night', type: 'portal',
    cpp: { low: 1.3, typical: 1.7, high: 2.8 }, effort: 'easy',
    note: 'The strongest hotel currency per point, on a published award chart.',
  },

  // --- Airline programs ---
  {
    id: 'delta_award', currencyId: 'delta', label: 'Award flight', type: 'portal',
    cpp: { low: 0.9, typical: 1.2, high: 2.0 }, effort: 'easy',
  },
  {
    id: 'united_award', currencyId: 'united', label: 'Award flight', type: 'portal',
    cpp: { low: 1.0, typical: 1.35, high: 2.5 }, effort: 'easy',
  },
  {
    id: 'aa_award', currencyId: 'aa', label: 'Award flight', type: 'portal',
    cpp: { low: 1.0, typical: 1.4, high: 3.0 }, effort: 'easy',
  },
  {
    id: 'southwest_award', currencyId: 'southwest', label: 'Award flight', type: 'portal',
    cpp: { low: 1.2, typical: 1.35, high: 1.5 }, effort: 'easy',
    note: 'Tightly pegged to cash fare, so the range is narrow and predictable.',
  },

  // --- Cash back is already cash ---
  {
    id: 'cash_direct', currencyId: 'cash', label: 'Statement credit', type: 'cash',
    cpp: fixed(1.0), effort: 'instant',
  },
];

/**
 * Transfer partners per transferable currency.
 *
 * Trimmed to the partners most people actually use rather than every partner
 * on the list -- a complete roster is noise at the point of decision.
 */
export const TRANSFER_PARTNERS: Partial<Record<CurrencyId, TransferPartner[]>> = {
  amex_mr: [
    { name: 'Delta SkyMiles', kind: 'airline', ratio: 1 },
    { name: 'Air Canada Aeroplan', kind: 'airline', ratio: 1 },
    { name: 'Air France/KLM Flying Blue', kind: 'airline', ratio: 1 },
    { name: 'British Airways Avios', kind: 'airline', ratio: 1 },
    { name: 'Virgin Atlantic', kind: 'airline', ratio: 1 },
    { name: 'ANA Mileage Club', kind: 'airline', ratio: 1 },
    { name: 'Singapore KrisFlyer', kind: 'airline', ratio: 1 },
    { name: 'Avianca LifeMiles', kind: 'airline', ratio: 1 },
    { name: 'Marriott Bonvoy', kind: 'hotel', ratio: 1 },
    { name: 'Hilton Honors', kind: 'hotel', ratio: 2 },
  ],
  chase_ur: [
    { name: 'World of Hyatt', kind: 'hotel', ratio: 1 },
    { name: 'United MileagePlus', kind: 'airline', ratio: 1 },
    { name: 'Southwest Rapid Rewards', kind: 'airline', ratio: 1 },
    { name: 'Air Canada Aeroplan', kind: 'airline', ratio: 1 },
    { name: 'Air France/KLM Flying Blue', kind: 'airline', ratio: 1 },
    { name: 'British Airways Avios', kind: 'airline', ratio: 1 },
    { name: 'Virgin Atlantic', kind: 'airline', ratio: 1 },
    { name: 'Singapore KrisFlyer', kind: 'airline', ratio: 1 },
    { name: 'IHG One Rewards', kind: 'hotel', ratio: 1 },
    { name: 'Marriott Bonvoy', kind: 'hotel', ratio: 1 },
  ],
  citi_ty: [
    { name: 'Air France/KLM Flying Blue', kind: 'airline', ratio: 1 },
    { name: 'Avianca LifeMiles', kind: 'airline', ratio: 1 },
    { name: 'Singapore KrisFlyer', kind: 'airline', ratio: 1 },
    { name: 'Turkish Miles&Smiles', kind: 'airline', ratio: 1 },
    { name: 'Virgin Atlantic', kind: 'airline', ratio: 1 },
    { name: 'Qatar Privilege Club', kind: 'airline', ratio: 1 },
    { name: 'Choice Privileges', kind: 'hotel', ratio: 2 },
  ],
  capone_miles: [
    { name: 'Air Canada Aeroplan', kind: 'airline', ratio: 1 },
    { name: 'Air France/KLM Flying Blue', kind: 'airline', ratio: 1 },
    { name: 'British Airways Avios', kind: 'airline', ratio: 1 },
    { name: 'Avianca LifeMiles', kind: 'airline', ratio: 1 },
    { name: 'Turkish Miles&Smiles', kind: 'airline', ratio: 1 },
    { name: 'Singapore KrisFlyer', kind: 'airline', ratio: 1 },
    { name: 'Virgin Red', kind: 'airline', ratio: 1 },
    { name: 'Choice Privileges', kind: 'hotel', ratio: 1 },
  ],
  bilt: [
    { name: 'World of Hyatt', kind: 'hotel', ratio: 1 },
    { name: 'Alaska Mileage Plan', kind: 'airline', ratio: 1 },
    { name: 'American AAdvantage', kind: 'airline', ratio: 1 },
    { name: 'Air Canada Aeroplan', kind: 'airline', ratio: 1 },
    { name: 'Air France/KLM Flying Blue', kind: 'airline', ratio: 1 },
    { name: 'Turkish Miles&Smiles', kind: 'airline', ratio: 1 },
    { name: 'Marriott Bonvoy', kind: 'hotel', ratio: 1 },
  ],
};

export function routesFor(currencyId: CurrencyId): RedemptionRoute[] {
  return REDEMPTION_ROUTES.filter((r) => r.currencyId === currencyId);
}
