import { describe, expect, it } from 'vitest';
import { bestUse, portfolioUpside } from './redeem';
import type { PointsBalance } from './points';

const bal = (currencyId: PointsBalance['currencyId'], amount: number): PointsBalance => ({
  currencyId,
  amount,
  updatedAt: '2026-09-01',
});

describe('bestUse', () => {
  it('contrasts the default route against the best one', () => {
    const [mr] = bestUse([bal('amex_mr', 184_500)]);

    // Statement credit at 0.6c is the default; transfer at 2.0c typical is best.
    expect(mr.defaultRoute.route.type).toBe('cash');
    expect(mr.defaultRoute.typical).toBeCloseTo(1107, 2);
    expect(mr.best.route.type).toBe('transfer');
    expect(mr.best.typical).toBeCloseTo(3690, 2);
    expect(mr.upside).toBeCloseTo(2583, 2);
  });

  it('carries the optimistic ceiling of the best route', () => {
    const [mr] = bestUse([bal('amex_mr', 100_000)]);
    // Transfers top out around 5c for premium cabins.
    expect(mr.best.high).toBeCloseTo(5000, 2);
    expect(mr.best.low).toBeCloseTo(1500, 2);
  });

  it('ranks routes by typical value', () => {
    const [mr] = bestUse([bal('amex_mr', 100_000)]);
    const typicals = mr.routes.map((r) => r.typical);
    expect([...typicals].sort((a, b) => b - a)).toEqual(typicals);
  });

  it('flags the Capital One cash-out penalty', () => {
    const [c1] = bestUse([bal('capone_miles', 100_000)]);
    // Cashing out at 0.5c is half what erasing a travel purchase gives.
    expect(c1.defaultRoute.typical).toBeCloseTo(500, 2);
    expect(c1.best.typical).toBeCloseTo(1700, 2);
  });

  it('reports no upside when cash back is already cash', () => {
    const [cash] = bestUse([bal('cash', 4_120)]);
    expect(cash.upside).toBeCloseTo(0, 6);
    expect(cash.best.typical).toBeCloseTo(41.2, 2);
  });

  it('reports no upside for a terminal currency with one route', () => {
    // Hilton points cannot transfer out; an award night is the only use.
    const [hilton] = bestUse([bal('hilton', 96_000)]);
    expect(hilton.routes).toHaveLength(1);
    expect(hilton.upside).toBeCloseTo(0, 6);
    expect(hilton.partners).toHaveLength(0);
  });

  it('lists transfer partners with their ratios', () => {
    const [mr] = bestUse([bal('amex_mr', 100_000)]);
    const hilton = mr.partners.find((p) => p.name === 'Hilton Honors');
    // 1:2 sounds generous but Hilton points are worth a quarter as much.
    expect(hilton!.ratio).toBe(2);
    expect(mr.partners.some((p) => p.kind === 'airline')).toBe(true);
  });

  it('pools balances sharing a currency before valuing them', () => {
    const [mr] = bestUse([bal('amex_mr', 100_000), bal('amex_mr', 84_500)]);
    expect(mr.amount).toBe(184_500);
  });

  it('orders programs by how much the decision is worth', () => {
    const uses = bestUse([
      bal('cash', 5_000),
      bal('amex_mr', 184_500),
      bal('hilton', 96_000),
    ]);
    expect(uses[0].currency.id).toBe('amex_mr');
    // Cash and Hilton both have zero upside and sort behind it.
    expect(uses[0].upside).toBeGreaterThan(uses[1].upside);
  });

  it('does not let a pessimistic valuation hide a good route', () => {
    // The user values MR at cash parity, but the transfer route's own rate
    // is a fact about the route and must survive the override.
    const [mr] = bestUse([bal('amex_mr', 100_000)], { amex_mr: 1.0 });
    expect(mr.best.route.type).toBe('transfer');
    expect(mr.best.typical).toBeCloseTo(2000, 2);
  });
});

describe('portfolioUpside', () => {
  it('totals what better redemption decisions are worth', () => {
    const uses = bestUse([bal('amex_mr', 100_000), bal('chase_ur', 50_000)]);
    const p = portfolioUpside(uses);

    // MR: 0.6c default vs 2.0c best. UR: 1.0c default vs 2.05c best.
    expect(p.defaultTotal).toBeCloseTo(600 + 500, 2);
    expect(p.bestTotal).toBeCloseTo(2000 + 1025, 2);
    expect(p.upside).toBeCloseTo(1925, 2);
    expect(p.bestCeiling).toBeCloseTo(5000 + 2000, 2);
  });

  it('is zero for a portfolio of cash', () => {
    const p = portfolioUpside(bestUse([bal('cash', 1_000)]));
    expect(p.upside).toBeCloseTo(0, 6);
  });
});
