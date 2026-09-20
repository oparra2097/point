/**
 * "I just walked into Mango. Which card do I pull out?"
 *
 * Ranks every card in the wallet by what it is actually worth at this
 * merchant, for this basket size, combining two independent sources of value:
 *
 *   1. The card's own earn rate for the category.
 *   2. Any targeted offer the user holds on that card for this merchant.
 *
 * Those two stack -- an Amex Offer pays a statement credit AND the purchase
 * still earns points -- but offers on DIFFERENT cards never stack, because
 * the purchase goes on exactly one card. That asymmetry is the whole reason
 * this has to be a per-card ranking rather than a sum.
 */

import { CARDS_BY_ID, type CardSpec } from '../data/cards';
import { guessCategory, type CategoryId } from '../data/categories';
import { CURRENCIES, type CurrencyId } from '../data/currencies';
import { ISSUERS, type IssuerInfo } from '../data/issuers';
import type { OfferKind } from './parseOffer';
import { daysUntil, localDateKey } from './dates';
import { matchMerchant } from './merchant';
import { earnOn, UNCAPPED_LEDGER, type CppOverrides } from './regret';

export interface UserOffer {
  id: string;
  /** Catalog id of the card this offer sits on. */
  cardId: string;
  /** Merchant as captured, matched fuzzily against where the user is. */
  merchant: string;
  kind: OfferKind;
  minSpend?: number;
  amountBack?: number;
  percentBack?: number;
  maxBack?: number;
  pointsBack?: number;
  /** ISO date. */
  expiresAt?: string;
  /** Offers pay nothing until enrolled in the issuer's app. */
  activated: boolean;
  source: 'manual' | 'email' | 'import';
  addedAt: string;
}

export interface OfferValue {
  offer: UserOffer;
  /** Dollars this offer pays on a basket of this size. */
  value: number;
  /** Dollars more that must be spent to unlock it, when short of a threshold. */
  shortfall?: number;
  /** Dollars this would pay if the threshold were met. */
  potentialValue: number;
}

export interface CardAtStore {
  card: CardSpec;
  issuer: IssuerInfo;
  category: CategoryId;
  /** Dollar value of points or cash back earned. */
  earnValue: number;
  /** The single best offer on this card for this merchant, if any. */
  bestOffer?: OfferValue;
  /** Dollar value from that offer. */
  offerValue: number;
  totalValue: number;
  /** totalValue as a fraction of the basket. 0.12 is 12% back. */
  effectiveRate: number;
  /** True when the winning offer has not been enrolled yet. */
  needsActivation: boolean;
  /** Days until the offer expires, when that is soon. */
  expiresInDays?: number;
  /** Plain-language lines explaining the number, for the UI. */
  reasons: string[];
}

export interface AtStoreOptions {
  cppOverrides?: CppOverrides;
  /** Overrides merchant-name inference when the user corrects the category. */
  categoryOverride?: CategoryId;
  now?: Date;
}

function cppOf(currency: CurrencyId, overrides: CppOverrides = {}): number {
  return overrides[currency] ?? CURRENCIES[currency].defaultCpp;
}

/**
 * Value one offer against a basket.
 *
 * `value` is what it pays at this exact amount; `potentialValue` is what it
 * would pay if a spend threshold were met. The UI needs both, so it can say
 * "spend $12 more to get $25 back" rather than silently showing zero.
 */
export function valueOffer(
  offer: UserOffer,
  amount: number,
  currency: CurrencyId,
  overrides: CppOverrides = {},
): OfferValue {
  const threshold = offer.minSpend ?? 0;
  const met = amount >= threshold;
  const shortfall = met ? undefined : threshold - amount;

  let potential = 0;
  switch (offer.kind) {
    case 'percent': {
      const pct = offer.percentBack ?? 0;
      // A percent offer's cap binds on the payout, not on the spend.
      const raw = (amount * pct) / 100;
      potential = offer.maxBack !== undefined ? Math.min(raw, offer.maxBack) : raw;
      break;
    }
    case 'spend_get':
      potential = offer.amountBack ?? 0;
      break;
    case 'points':
      potential = ((offer.pointsBack ?? 0) * cppOf(currency, overrides)) / 100;
      break;
    default:
      potential = 0;
  }

  return { offer, value: met ? potential : 0, shortfall, potentialValue: potential };
}

/** Offers on this card, for this merchant, that have not expired. */
function liveOffersFor(
  card: CardSpec,
  merchant: string,
  offers: UserOffer[],
  now: Date,
): UserOffer[] {
  const today = localDateKey(now);
  return offers.filter(
    (o) =>
      o.cardId === card.id &&
      (!o.expiresAt || o.expiresAt >= today) &&
      matchMerchant(o.merchant, merchant).matches,
  );
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * Rank the wallet for a merchant and basket size.
 *
 * Unactivated offers are still counted in the ranking and flagged, rather than
 * valued at zero: the user can activate in seconds before paying, and hiding
 * the value would defeat the purpose of showing it.
 *
 * Earn rates assume bonus-category headroom remains. At the register we do not
 * know how much of an annual cap has been consumed; once a transaction feed is
 * connected, the live cap state should be threaded through here.
 */
export function atStore(
  merchant: string,
  amount: number,
  wallet: string[],
  offers: UserOffer[],
  opts: AtStoreOptions = {},
): CardAtStore[] {
  const now = opts.now ?? new Date();
  const category = opts.categoryOverride ?? guessCategory(merchant);
  const held = wallet.map((id) => CARDS_BY_ID[id]).filter(Boolean) as CardSpec[];

  const ranked = held.map((card): CardAtStore => {
    const earning = earnOn(card, category, amount, UNCAPPED_LEDGER, now.getFullYear(), {
      cppOverrides: opts.cppOverrides,
    });

    const candidates = liveOffersFor(card, merchant, offers, now).map((o) =>
      valueOffer(o, amount, card.currency, opts.cppOverrides),
    );

    // Only one offer per card applies to a purchase, so take the strongest.
    // Rank on potential rather than realised value, so an offer the user is
    // $5 short of still surfaces instead of being beaten by a weaker one.
    const bestOffer = candidates.sort(
      (a, b) => b.potentialValue - a.potentialValue || b.value - a.value,
    )[0];

    const offerValue = bestOffer?.value ?? 0;
    const totalValue = earning.value + offerValue;

    const reasons: string[] = [];
    const rateLabel =
      card.currency === 'cash'
        ? `${earning.rate}% back`
        : `${earning.rate}x ${CURRENCIES[card.currency].shortName}`;
    reasons.push(`${rateLabel} - ${money(earning.value)}`);
    if (earning.capped) reasons.push('Bonus category cap reached; earning base rate');

    if (bestOffer) {
      const o = bestOffer.offer;
      const label =
        o.kind === 'percent'
          ? `${o.percentBack}% back${o.maxBack ? ` (max ${money(o.maxBack)})` : ''}`
          : o.kind === 'points'
            ? `${(o.pointsBack ?? 0).toLocaleString()} points`
            : `${money(o.amountBack ?? 0)} back${o.minSpend ? ` on ${money(o.minSpend)}` : ''}`;

      if (bestOffer.shortfall !== undefined) {
        reasons.push(`${ISSUERS[card.issuer].offerProgram}: ${label} - spend ${money(bestOffer.shortfall)} more`);
      } else {
        reasons.push(`${ISSUERS[card.issuer].offerProgram}: ${label} - ${money(bestOffer.value)}`);
      }
      if (!o.activated) reasons.push('Not activated yet');
    }

    const expiresInDays = bestOffer?.offer.expiresAt
      ? daysUntil(bestOffer.offer.expiresAt, now)
      : undefined;

    return {
      card,
      issuer: ISSUERS[card.issuer],
      category,
      earnValue: earning.value,
      bestOffer,
      offerValue,
      totalValue,
      effectiveRate: amount > 0 ? totalValue / amount : 0,
      needsActivation: Boolean(bestOffer && !bestOffer.offer.activated),
      expiresInDays,
      reasons,
    };
  });

  return ranked.sort((a, b) => b.totalValue - a.totalValue);
}

/** Every unactivated, unexpired offer across the wallet, most valuable first. */
export function unactivatedOffers(offers: UserOffer[], now: Date = new Date()): UserOffer[] {
  const today = localDateKey(now);
  return offers
    .filter((o) => !o.activated && (!o.expiresAt || o.expiresAt >= today))
    .sort((a, b) => {
      // Soonest expiry first -- that is the money about to evaporate.
      if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
      if (a.expiresAt) return -1;
      if (b.expiresAt) return 1;
      return 0;
    });
}

/** Just the economic terms -- everything describeOffer needs to render. */
export type OfferTerms = Pick<
  UserOffer,
  'kind' | 'minSpend' | 'amountBack' | 'percentBack' | 'maxBack' | 'pointsBack'
>;

/**
 * One-line human description of an offer's terms.
 *
 * Takes the terms alone rather than a full UserOffer so a freshly parsed
 * offer, which has no id or card yet, can be previewed before it is saved.
 */
export function describeOffer(offer: OfferTerms): string {
  const dollars = (n: number) => `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
  switch (offer.kind) {
    case 'percent':
      return `${offer.percentBack}% back${offer.maxBack ? ` up to ${dollars(offer.maxBack)}` : ''}`;
    case 'spend_get':
      return offer.minSpend
        ? `${dollars(offer.amountBack ?? 0)} back on ${dollars(offer.minSpend)}`
        : `${dollars(offer.amountBack ?? 0)} back`;
    case 'points':
      return `${(offer.pointsBack ?? 0).toLocaleString()} points${offer.minSpend ? ` on ${dollars(offer.minSpend)}` : ''}`;
    default:
      return 'Offer';
  }
}

/**
 * The most an offer could ever pay, where that is bounded.
 *
 * Returns undefined for an uncapped percent offer, because its ceiling
 * depends on how much is spent and inventing one would overstate what is
 * sitting unclaimed. Callers should present those separately rather than
 * folding a guess into a total.
 */
export function offerCeiling(
  offer: OfferTerms,
  currency: CurrencyId,
  overrides: CppOverrides = {},
): number | undefined {
  switch (offer.kind) {
    case 'percent':
      return offer.maxBack;
    case 'spend_get':
      return offer.amountBack;
    case 'points':
      return ((offer.pointsBack ?? 0) * cppOf(currency, overrides)) / 100;
    default:
      return undefined;
  }
}
