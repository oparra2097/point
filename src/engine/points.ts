/**
 * Aggregate points across every program the user holds.
 *
 * Two numbers matter here and they answer different questions. The raw point
 * total is what people ask for ("how many points do I have?") but it is an
 * apples-to-oranges sum -- 50k Hilton and 50k Amex MR are not the same asset,
 * and adding them implies otherwise. The dollar value is the number that is
 * actually comparable, so the UI should lead with it and treat the raw count
 * as secondary.
 *
 * Balances are grouped by currency rather than by card on purpose: three Amex
 * cards share one Membership Rewards pool, so listing them separately would
 * triple-count the same points.
 */

import { CURRENCIES, type Currency, type CurrencyId } from '../data/currencies';
import type { CppOverrides } from './regret';

export interface PointsBalance {
  currencyId: CurrencyId;
  amount: number;
  /** ISO date this balance was last confirmed. */
  updatedAt: string;
}

export interface PointsLine {
  currency: Currency;
  amount: number;
  /** Cents per point actually applied, after any user override. */
  cpp: number;
  value: number;
  /** Fraction of total portfolio value, 0-1. */
  share: number;
}

export interface PointsSummary {
  /** The meaningful total: what the whole portfolio is worth in dollars. */
  totalValue: number;
  /**
   * Raw points summed across programs. Headline-friendly but not an
   * economically meaningful figure -- see the note above.
   */
  totalPoints: number;
  lines: PointsLine[];
  /** ISO date of the least recently updated balance, or undefined if none. */
  stalestUpdate?: string;
}

export function aggregatePoints(
  balances: PointsBalance[],
  overrides: CppOverrides = {},
): PointsSummary {
  const pooled = new Map<CurrencyId, { amount: number; updatedAt: string }>();
  for (const b of balances) {
    if (b.amount <= 0) continue;
    const existing = pooled.get(b.currencyId);
    if (existing) {
      existing.amount += b.amount;
      if (b.updatedAt < existing.updatedAt) existing.updatedAt = b.updatedAt;
    } else {
      pooled.set(b.currencyId, { amount: b.amount, updatedAt: b.updatedAt });
    }
  }

  const raw = [...pooled.entries()].map(([id, { amount }]) => {
    const cpp = overrides[id] ?? CURRENCIES[id].defaultCpp;
    return { currency: CURRENCIES[id], amount, cpp, value: (amount * cpp) / 100 };
  });

  const totalValue = raw.reduce((s, l) => s + l.value, 0);
  const totalPoints = raw.reduce((s, l) => s + l.amount, 0);

  const lines: PointsLine[] = raw
    .map((l) => ({ ...l, share: totalValue > 0 ? l.value / totalValue : 0 }))
    .sort((a, b) => b.value - a.value);

  const updates = [...pooled.values()].map((p) => p.updatedAt).sort();

  return { totalValue, totalPoints, lines, stalestUpdate: updates[0] };
}
