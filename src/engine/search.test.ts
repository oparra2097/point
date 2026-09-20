import { describe, expect, it } from 'vitest';
import { offerMerchants, searchOffers } from './search';
import type { UserOffer } from './atStore';
import { daysUntil, isLive, localDateKey } from './dates';

const NOW = new Date('2026-09-20T12:00:00Z');

const offer = (
  o: Partial<UserOffer> & Pick<UserOffer, 'cardId' | 'merchant'>,
): UserOffer => ({
  id: Math.random().toString(36).slice(2),
  kind: 'percent',
  percentBack: 10,
  activated: true,
  source: 'manual',
  addedAt: '2026-09-01',
  ...o,
});

const OFFERS = [
  offer({ cardId: 'amex_gold', merchant: 'Mango', expiresAt: '2026-12-31' }),
  offer({ cardId: 'chase_csp', merchant: 'MANGO USA', expiresAt: '2026-11-15' }),
  offer({ cardId: 'amex_platinum', merchant: 'SQ *SWEETGREEN', expiresAt: '2026-10-05' }),
  offer({ cardId: 'capone_savor', merchant: 'Nike', expiresAt: '2026-10-02' }),
];

describe('searchOffers', () => {
  it('matches a partial prefix as the user types', () => {
    // The strict merchant matcher refuses this (3 chars, under its floor);
    // incremental search has to allow it.
    const hits = searchOffers('man', OFFERS, NOW);
    expect(hits).toHaveLength(2);
    expect(hits.every((h) => h.offer.merchant.toLowerCase().includes('mango'))).toBe(true);
  });

  it('treats descriptor variants of one merchant as equal matches', () => {
    // "MANGO USA" normalizes to "mango" -- "usa" is corporate noise -- so both
    // offers match exactly and the tiebreak is which expires first.
    const hits = searchOffers('mango', OFFERS, NOW);
    expect(hits).toHaveLength(2);
    expect(hits.every((h) => h.score === 1)).toBe(true);
    expect(hits[0].offer.merchant).toBe('MANGO USA');
  });

  it('searches through processor prefixes in the stored name', () => {
    const hits = searchOffers('sweetgreen', OFFERS, NOW);
    expect(hits).toHaveLength(1);
    expect(hits[0].card.id).toBe('amex_platinum');
  });

  it('tolerates a typo in a long name without outranking a real prefix', () => {
    const hits = searchOffers('sweetgren', OFFERS, NOW);
    expect(hits).toHaveLength(1);
    expect(hits[0].offer.merchant).toBe('SQ *SWEETGREEN');
    // Fuzzy hits are scaled down so they never reach prefix-match territory.
    expect(hits[0].score).toBeLessThan(0.75);
  });

  it('does not fuzzy-match short names, where bigram overlap collapses', () => {
    // "nkie" shares no bigrams at all with "nike": a single transposition in a
    // four-letter word wipes out the signal. Prefix matching covers short
    // names instead, which is what incremental typing produces anyway.
    expect(searchOffers('nkie', OFFERS, NOW)).toHaveLength(0);
    expect(searchOffers('nik', OFFERS, NOW)).toHaveLength(1);
  });

  it('returns everything soonest-expiring first for an empty query', () => {
    const hits = searchOffers('', OFFERS, NOW);
    expect(hits).toHaveLength(4);
    expect(hits[0].offer.merchant).toBe('Nike');
  });

  it('excludes expired offers', () => {
    const withExpired = [...OFFERS, offer({ cardId: 'amex_gold', merchant: 'Zara', expiresAt: '2026-01-01' })];
    expect(searchOffers('zara', withExpired, NOW)).toHaveLength(0);
  });

  it('drops offers whose card is no longer in the catalog', () => {
    const orphan = [offer({ cardId: 'deleted_card', merchant: 'Mango' })];
    expect(searchOffers('mango', orphan, NOW)).toHaveLength(0);
  });

  it('returns no hits for an unrelated query', () => {
    expect(searchOffers('hardware', OFFERS, NOW)).toHaveLength(0);
  });
});

describe('offerMerchants', () => {
  it('lists distinct live merchants', () => {
    const names = offerMerchants(OFFERS, NOW);
    // The two Mango variants collapse to one entry.
    expect(names).toHaveLength(3);
  });
});

describe('date helpers', () => {
  it('formats the local calendar date', () => {
    expect(localDateKey(new Date(2026, 8, 20))).toBe('2026-09-20');
  });

  it('counts whole calendar days', () => {
    expect(daysUntil('2026-09-25', NOW)).toBe(5);
    expect(daysUntil('2026-09-20', NOW)).toBe(0);
    expect(daysUntil('2026-09-19', NOW)).toBe(-1);
  });

  it('treats a missing expiry as live', () => {
    expect(isLive(undefined, NOW)).toBe(true);
    expect(isLive('2026-09-20', NOW)).toBe(true);
    expect(isLive('2026-09-19', NOW)).toBe(false);
  });
});
