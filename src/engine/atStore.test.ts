import { describe, expect, it } from 'vitest';
import { atStore, unactivatedOffers, valueOffer, type UserOffer } from './atStore';
import { aggregatePoints } from './points';

const NOW = new Date('2026-09-20T12:00:00Z');
const WALLET = ['amex_gold', 'chase_freedom_unlimited', 'capone_savor'];

const offer = (
  o: Partial<UserOffer> & Pick<UserOffer, 'cardId' | 'merchant' | 'kind'>,
): UserOffer => ({
  id: Math.random().toString(36).slice(2),
  activated: true,
  source: 'manual',
  addedAt: '2026-09-01',
  ...o,
});

describe('atStore - walking into a store', () => {
  it('ranks by earn rate when no offers apply', () => {
    const ranked = atStore('Mango', 100, WALLET, [], { now: NOW });
    // Mango is not a known merchant, so it falls back to "everything else".
    expect(ranked[0].category).toBe('other');
    // Freedom Unlimited's 1.5x UR at 2.05c beats Gold's 1x MR at 2.0c.
    expect(ranked[0].card.id).toBe('chase_freedom_unlimited');
    expect(ranked[0].totalValue).toBeCloseTo(3.075, 3);
  });

  it('lets an offer beat a better base earn rate', () => {
    const offers = [
      offer({ cardId: 'amex_gold', merchant: 'Mango', kind: 'percent', percentBack: 20, maxBack: 30 }),
    ];
    const ranked = atStore('Mango', 100, WALLET, offers, { now: NOW });

    expect(ranked[0].card.id).toBe('amex_gold');
    // The offer stacks on top of the card's own earning: $20 + $2.
    expect(ranked[0].offerValue).toBeCloseTo(20, 2);
    expect(ranked[0].earnValue).toBeCloseTo(2, 2);
    expect(ranked[0].totalValue).toBeCloseTo(22, 2);
  });

  it('matches an offer to the store through a messy descriptor', () => {
    const offers = [
      offer({ cardId: 'amex_gold', merchant: 'SQ *MANGO #0421', kind: 'percent', percentBack: 20 }),
    ];
    const ranked = atStore('Mango', 100, WALLET, offers, { now: NOW });
    expect(ranked[0].card.id).toBe('amex_gold');
  });

  it('caps a percent offer at its maximum payout', () => {
    const offers = [
      offer({ cardId: 'amex_gold', merchant: 'Mango', kind: 'percent', percentBack: 20, maxBack: 30 }),
    ];
    const ranked = atStore('Mango', 500, WALLET, offers, { now: NOW });
    // 20% of $500 is $100, but the offer stops at $30.
    expect(ranked[0].offerValue).toBeCloseTo(30, 2);
  });

  it('reports how much more to spend to unlock a threshold offer', () => {
    const offers = [
      offer({
        cardId: 'amex_gold',
        merchant: 'Mango',
        kind: 'spend_get',
        minSpend: 150,
        amountBack: 30,
      }),
    ];
    const ranked = atStore('Mango', 100, WALLET, offers, { now: NOW });
    const gold = ranked.find((r) => r.card.id === 'amex_gold')!;

    expect(gold.bestOffer!.shortfall).toBeCloseTo(50, 2);
    expect(gold.bestOffer!.value).toBe(0);
    expect(gold.bestOffer!.potentialValue).toBeCloseTo(30, 2);
    expect(gold.reasons.some((r) => r.includes('spend $50.00 more'))).toBe(true);
    // Unearned, so it must not win the ranking.
    expect(ranked[0].card.id).toBe('chase_freedom_unlimited');
  });

  it('flags an offer that has not been activated', () => {
    const offers = [
      offer({
        cardId: 'amex_gold',
        merchant: 'Mango',
        kind: 'percent',
        percentBack: 20,
        activated: false,
      }),
    ];
    const ranked = atStore('Mango', 100, WALLET, offers, { now: NOW });

    expect(ranked[0].needsActivation).toBe(true);
    expect(ranked[0].reasons).toContain('Not activated yet');
    // Still counted in the ranking -- it can be activated before paying.
    expect(ranked[0].offerValue).toBeCloseTo(20, 2);
  });

  it('ignores expired offers', () => {
    const offers = [
      offer({
        cardId: 'amex_gold',
        merchant: 'Mango',
        kind: 'percent',
        percentBack: 20,
        expiresAt: '2026-01-01',
      }),
    ];
    const ranked = atStore('Mango', 100, WALLET, offers, { now: NOW });
    expect(ranked[0].card.id).toBe('chase_freedom_unlimited');
    expect(ranked.every((r) => r.bestOffer === undefined)).toBe(true);
  });

  it('does not leak an offer from one card onto another', () => {
    const offers = [
      offer({ cardId: 'amex_gold', merchant: 'Mango', kind: 'percent', percentBack: 20 }),
    ];
    const ranked = atStore('Mango', 100, WALLET, offers, { now: NOW });
    const cfu = ranked.find((r) => r.card.id === 'chase_freedom_unlimited')!;
    expect(cfu.bestOffer).toBeUndefined();
    expect(cfu.offerValue).toBe(0);
  });

  it('picks the strongest offer when one card has several', () => {
    const offers = [
      offer({ cardId: 'amex_gold', merchant: 'Mango', kind: 'percent', percentBack: 5 }),
      offer({ cardId: 'amex_gold', merchant: 'Mango', kind: 'spend_get', minSpend: 50, amountBack: 25 }),
    ];
    const ranked = atStore('Mango', 100, WALLET, offers, { now: NOW });
    // $25 back beats 5% of $100, and offers on one card never stack.
    expect(ranked[0].offerValue).toBeCloseTo(25, 2);
  });

  it('counts days remaining on the winning offer', () => {
    const offers = [
      offer({
        cardId: 'amex_gold',
        merchant: 'Mango',
        kind: 'percent',
        percentBack: 20,
        expiresAt: '2026-09-25',
      }),
    ];
    const ranked = atStore('Mango', 100, WALLET, offers, { now: NOW });
    expect(ranked[0].expiresInDays).toBe(5);
  });
});

describe('valueOffer', () => {
  it('values a points offer through the currency valuation', () => {
    const v = valueOffer(
      offer({ cardId: 'amex_gold', merchant: 'Mango', kind: 'points', pointsBack: 5000, minSpend: 100 }),
      100,
      'amex_mr',
    );
    // 5,000 MR at 2.0c.
    expect(v.value).toBeCloseTo(100, 2);
  });
});

describe('unactivatedOffers', () => {
  it('surfaces unactivated offers soonest-expiring first', () => {
    const offers = [
      offer({ cardId: 'amex_gold', merchant: 'A', kind: 'percent', percentBack: 5, activated: false, expiresAt: '2026-12-01' }),
      offer({ cardId: 'amex_gold', merchant: 'B', kind: 'percent', percentBack: 5, activated: false, expiresAt: '2026-10-01' }),
      offer({ cardId: 'amex_gold', merchant: 'C', kind: 'percent', percentBack: 5, activated: true }),
      offer({ cardId: 'amex_gold', merchant: 'D', kind: 'percent', percentBack: 5, activated: false, expiresAt: '2026-01-01' }),
    ];
    const out = unactivatedOffers(offers, NOW);
    expect(out.map((o) => o.merchant)).toEqual(['B', 'A']);
  });
});

describe('aggregatePoints', () => {
  it('pools balances that share a currency', () => {
    // Two Amex cards draw on one Membership Rewards pool.
    const s = aggregatePoints([
      { currencyId: 'amex_mr', amount: 40000, updatedAt: '2026-09-01' },
      { currencyId: 'amex_mr', amount: 20000, updatedAt: '2026-08-01' },
    ]);
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].amount).toBe(60000);
    expect(s.totalValue).toBeCloseTo(1200, 2);
    // Staleness reflects the least recently confirmed balance.
    expect(s.stalestUpdate).toBe('2026-08-01');
  });

  it('values a mixed portfolio and ranks by dollars, not point count', () => {
    const s = aggregatePoints([
      { currencyId: 'hilton', amount: 100000, updatedAt: '2026-09-01' },
      { currencyId: 'chase_ur', amount: 50000, updatedAt: '2026-09-01' },
    ]);
    // Hilton has twice the points but half the value: 100k x 0.5c = $500
    // against 50k x 2.05c = $1,025.
    expect(s.lines[0].currency.id).toBe('chase_ur');
    expect(s.totalValue).toBeCloseTo(1525, 2);
    expect(s.totalPoints).toBe(150000);
    expect(s.lines[0].share).toBeCloseTo(1025 / 1525, 4);
  });

  it('respects user valuations', () => {
    const s = aggregatePoints(
      [{ currencyId: 'amex_mr', amount: 100000, updatedAt: '2026-09-01' }],
      { amex_mr: 1.0 },
    );
    expect(s.totalValue).toBeCloseTo(1000, 2);
  });
});
