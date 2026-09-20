/**
 * Search across every offer in the wallet.
 *
 * Typing is incremental, so this matches partial input -- "man" must find
 * Mango -- which the strict merchant matcher deliberately will not do: its
 * four-character floor exists to stop "bp" matching "bpm fitness" when
 * deciding whether two descriptors are the same store. Different job, so a
 * different, looser matcher, ranked rather than boolean.
 */

import { CARDS_BY_ID, type CardSpec } from '../data/cards';
import type { UserOffer } from './atStore';
import { isLive } from './dates';
import { normalizeMerchant, similarity } from './merchant';

export interface OfferHit {
  offer: UserOffer;
  card: CardSpec;
  /** 0-1; exact merchant match is 1. */
  score: number;
}

/**
 * Minimum fuzzy score before a hit is shown at all.
 *
 * Bigram overlap only rescues typos in reasonably long names. In a short one a
 * single transposition can remove every shared bigram -- "nkie" and "nike"
 * share none -- so short merchants rely on exact and prefix matching, which is
 * what incremental typing produces anyway.
 */
const FUZZY_FLOOR = 0.6;

export function searchOffers(
  query: string,
  offers: UserOffer[],
  now: Date = new Date(),
): OfferHit[] {
  const withCards = offers
    .filter((o) => isLive(o.expiresAt, now))
    .map((offer) => ({ offer, card: CARDS_BY_ID[offer.cardId] }))
    .filter((x): x is { offer: UserOffer; card: CardSpec } => Boolean(x.card));

  const q = normalizeMerchant(query);

  // No query: show everything, soonest to expire first, since that is the
  // most useful default ordering for a list you are browsing.
  if (!q) {
    return withCards
      .map(({ offer, card }) => ({ offer, card, score: 0 }))
      .sort((a, b) => (a.offer.expiresAt ?? '9999').localeCompare(b.offer.expiresAt ?? '9999'));
  }

  const hits: OfferHit[] = [];
  for (const { offer, card } of withCards) {
    const m = normalizeMerchant(offer.merchant);
    let score = 0;

    if (m === q) score = 1;
    else if (m.startsWith(q)) score = 0.9;
    else if (m.includes(q)) score = 0.75;
    else {
      // Fuzzy only as a fallback, and scaled down so a typo never outranks a
      // real prefix match.
      const s = similarity(m, q);
      if (s >= FUZZY_FLOOR) score = s * 0.7;
    }

    if (score > 0) hits.push({ offer, card, score });
  }

  return hits.sort(
    (a, b) =>
      b.score - a.score ||
      (a.offer.expiresAt ?? '9999').localeCompare(b.offer.expiresAt ?? '9999'),
  );
}

/** Distinct merchants across live offers, for browse-style suggestions. */
export function offerMerchants(offers: UserOffer[], now: Date = new Date()): string[] {
  const seen = new Map<string, string>();
  for (const o of offers) {
    if (!isLive(o.expiresAt, now)) continue;
    const key = normalizeMerchant(o.merchant);
    if (key && !seen.has(key)) seen.set(key, o.merchant);
  }
  return [...seen.values()];
}
