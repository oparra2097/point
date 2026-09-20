import { describe, expect, it } from 'vitest';
import { analyze, findMissedCredits, type Transaction } from './regret';
import { CARDS_BY_ID } from '../data/cards';

const txn = (o: Partial<Transaction> & Pick<Transaction, 'amount' | 'cardId'>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  merchant: 'Test Merchant',
  date: '2026-03-15',
  ...o,
});

describe('analyze - counterfactual regret', () => {
  it('values a purchase on the card used and names a better one held', () => {
    const a = analyze(
      [txn({ amount: 100, cardId: 'chase_freedom_unlimited', categoryId: 'dining' })],
      ['amex_gold', 'chase_freedom_unlimited'],
    );

    // Freedom Unlimited: 3x UR at 2.05c = $6.15. Gold: 4x MR at 2.0c = $8.00.
    expect(a.actualValue).toBeCloseTo(6.15, 2);
    expect(a.optimalValue).toBeCloseTo(8.0, 2);
    expect(a.totalLost).toBeCloseTo(1.85, 2);
    expect(a.lines[0].bestCardId).toBe('amex_gold');
  });

  it('reports no loss when the best card was already used', () => {
    const a = analyze(
      [txn({ amount: 100, cardId: 'amex_gold', categoryId: 'dining' })],
      ['amex_gold', 'chase_freedom_unlimited'],
    );
    expect(a.totalLost).toBeCloseTo(0, 6);
    expect(a.lines[0].lost).toBeCloseTo(0, 6);
  });

  it('drops a bonus rate to the base rate once the annual cap is exhausted', () => {
    // Gold pays 4x on dining only to $50k/yr; the rest earns the 1x base.
    const a = analyze(
      [
        txn({ amount: 30000, cardId: 'amex_gold', categoryId: 'dining', date: '2026-01-10' }),
        txn({ amount: 30000, cardId: 'amex_gold', categoryId: 'dining', date: '2026-06-10' }),
      ],
      ['amex_gold'],
    );

    // 50k at 4x + 10k at 1x, valued at 2.0c: $4000 + $200.
    expect(a.actualValue).toBeCloseTo(4200, 2);
  });

  it('resets caps at the year boundary', () => {
    const a = analyze(
      [
        txn({ amount: 50000, cardId: 'amex_gold', categoryId: 'dining', date: '2026-06-10' }),
        txn({ amount: 50000, cardId: 'amex_gold', categoryId: 'dining', date: '2027-06-10' }),
      ],
      ['amex_gold'],
    );
    // Both years get the full 4x cap: 2 x $4000.
    expect(a.actualValue).toBeCloseTo(8000, 2);
  });

  it('excludes portal-only rates for an in-person purchase', () => {
    const wallet = ['chase_csp', 'capone_venture_x', 'amex_platinum'];
    const a = analyze([txn({ amount: 1000, cardId: 'amex_platinum', categoryId: 'hotels' })], wallet);

    // Venture X's 10x and Platinum's 5x are portal-only, so the winner is the
    // Sapphire Preferred's 2x on travel booked direct: $1000 x 2 x 2.05c.
    expect(a.lines[0].bestCardId).toBe('chase_csp');
    expect(a.optimalValue).toBeCloseTo(41.0, 2);
  });

  it('allows portal rates when the booking could have gone through a portal', () => {
    const wallet = ['chase_csp', 'capone_venture_x', 'amex_platinum'];
    const a = analyze(
      [txn({ amount: 1000, cardId: 'amex_platinum', categoryId: 'hotels' })],
      wallet,
      { portalEligible: true },
    );

    // Venture X 10x miles at 1.7c = $170.
    expect(a.lines[0].bestCardId).toBe('capone_venture_x');
    expect(a.optimalValue).toBeCloseTo(170.0, 2);
  });

  it('respects user point valuations', () => {
    // Someone who only redeems MR for cash values it at 1.0c, not 2.0c.
    const a = analyze(
      [txn({ amount: 100, cardId: 'chase_freedom_unlimited', categoryId: 'dining' })],
      ['amex_gold', 'chase_freedom_unlimited'],
      { cppOverrides: { amex_mr: 1.0 } },
    );
    // Gold now yields only $4.00, so the Freedom Unlimited's $6.15 wins.
    expect(a.lines[0].bestCardId).toBe('chase_freedom_unlimited');
    expect(a.totalLost).toBeCloseTo(0, 6);
  });

  it('ranks category leaks by dollars lost and names the fix', () => {
    const a = analyze(
      [
        txn({ amount: 500, cardId: 'chase_freedom_unlimited', categoryId: 'groceries' }),
        txn({ amount: 100, cardId: 'chase_freedom_unlimited', categoryId: 'dining' }),
      ],
      ['amex_gold', 'amex_bcp', 'chase_freedom_unlimited'],
    );

    expect(a.leaks[0].category).toBe('groceries');
    expect(a.leaks[0].lost).toBeGreaterThan(a.leaks[1].lost);
    // Gold's 4x MR at 2.0c is 8c per dollar on groceries, which beats the
    // Blue Cash Preferred's flat 6% -- a points card wins whenever the
    // valuation holds up.
    expect(a.leaks[0].bestCardId).toBe('amex_gold');
  });

  it('flips the best grocery card when points are valued at cash parity', () => {
    const a = analyze(
      [txn({ amount: 500, cardId: 'chase_freedom_unlimited', categoryId: 'groceries' })],
      ['amex_gold', 'amex_bcp', 'chase_freedom_unlimited'],
      { cppOverrides: { amex_mr: 1.0 } },
    );
    // At 1.0c the Gold yields 4%, so the 6% cash-back card now wins.
    expect(a.leaks[0].bestCardId).toBe('amex_bcp');
  });

  it('infers the category from the merchant when none is supplied', () => {
    const a = analyze(
      [txn({ amount: 100, cardId: 'chase_freedom_unlimited', merchant: 'SQ *SWEETGREEN #1234' })],
      ['amex_gold', 'chase_freedom_unlimited'],
    );
    expect(a.lines[0].category).toBe('dining');
    expect(a.lines[0].bestCardId).toBe('amex_gold');
  });
});

describe('findMissedCredits', () => {
  const platinum = CARDS_BY_ID['amex_platinum'];

  it('flags a credit forfeited because the charge sat on another card', () => {
    const missed = findMissedCredits(
      [txn({ amount: 22, cardId: 'chase_csp', merchant: 'Netflix', date: '2026-01-14' })],
      [platinum],
    );

    const digital = missed.find((m) => m.creditId === 'plat_digital');
    expect(digital).toBeDefined();
    // The credit is $20/mo, so $20 of the $22 was recoverable.
    expect(digital!.recoverable).toBeCloseTo(20, 2);
    expect(digital!.period).toBe('2026-01');
  });

  it('does not flag a credit that the right card already consumed', () => {
    const missed = findMissedCredits(
      [txn({ amount: 22, cardId: 'amex_platinum', merchant: 'Netflix', date: '2026-01-14' })],
      [platinum],
    );
    expect(missed.find((m) => m.creditId === 'plat_digital')).toBeUndefined();
  });

  it('treats a monthly credit as resetting each month', () => {
    const missed = findMissedCredits(
      [
        txn({ amount: 22, cardId: 'chase_csp', merchant: 'Netflix', date: '2026-01-14' }),
        txn({ amount: 22, cardId: 'chase_csp', merchant: 'Netflix', date: '2026-02-14' }),
        txn({ amount: 22, cardId: 'chase_csp', merchant: 'Netflix', date: '2026-03-14' }),
      ],
      [platinum],
    );

    const digital = missed.filter((m) => m.creditId === 'plat_digital');
    expect(digital).toHaveLength(3);
    expect(digital.reduce((s, m) => s + m.recoverable, 0)).toBeCloseTo(60, 2);
  });

  it('caps recoverable at the spend available to move', () => {
    // Only $6 of Uber spend, against a $15/mo credit.
    const missed = findMissedCredits(
      [txn({ amount: 6, cardId: 'chase_csp', merchant: 'UBER *TRIP', date: '2026-01-14' })],
      [platinum],
    );
    const uber = missed.find((m) => m.creditId === 'plat_uber');
    expect(uber!.recoverable).toBeCloseTo(6, 2);
  });
});
