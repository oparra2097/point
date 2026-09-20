/**
 * What the user already lost.
 *
 * Given a transaction feed (Plaid) and the cards they hold, compute the gap
 * between what they earned and what they could have earned. This needs no
 * offer data at all, which is the point: it produces a real dollar figure the
 * moment an account is linked, with nothing to import by hand.
 *
 * Three correctness traps this module exists to avoid:
 *
 *  1. Annual caps. Amex Gold pays 4x on restaurants only up to $50k a year.
 *     Evaluating each transaction independently silently pays 4x on unlimited
 *     spend and inflates the headline number, so caps are consumed against a
 *     ledger as transactions are walked in date order.
 *
 *  2. Portal-only rates. Venture X pays 10x on hotels booked through Capital
 *     One Travel -- not at the front desk. Counting portal rates when comparing
 *     cards for an in-person swipe invents regret that was never available.
 *
 *  3. Counterfactual caps. "What if I had routed everything optimally" is not
 *     the sum of per-transaction bests: moving all dining to the Gold fills the
 *     Gold's cap sooner. The optimal figure is a full second simulation with
 *     its own ledger, not a sum of local maxima.
 */

import { CARDS_BY_ID, type CardSpec, type Credit, type EarnRule } from '../data/cards';
import { guessCategory, type CategoryId } from '../data/categories';
import { CURRENCIES, type CurrencyId } from '../data/currencies';
import { matchMerchant } from './merchant';

export interface Transaction {
  id: string;
  merchant: string;
  /** Positive dollars spent. Refunds and payments should be filtered upstream. */
  amount: number;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Catalog id of the card actually used. */
  cardId: string;
  /** Plaid's category when available; otherwise inferred from the merchant. */
  categoryId?: CategoryId;
}

export type CppOverrides = Partial<Record<CurrencyId, number>>;

export interface Options {
  cppOverrides?: CppOverrides;
  /**
   * Whether the purchase could have gone through an issuer travel portal.
   * False for anything swiped in person, which is the safe default.
   */
  portalEligible?: boolean;
}

function cppOf(currency: CurrencyId, overrides: CppOverrides = {}): number {
  return overrides[currency] ?? CURRENCIES[currency].defaultCpp;
}

function yearOf(isoDate: string): number {
  return parseInt(isoDate.slice(0, 4), 10);
}

function categoryOf(txn: Transaction): CategoryId {
  return txn.categoryId ?? guessCategory(txn.merchant);
}

/**
 * Tracks how much bonus-rate headroom a capped earn rule has left.
 *
 * Abstracted so callers that legitimately have no cap state -- the at-register
 * ranking, which cannot know how much of an annual cap has been spent -- can
 * pass UNCAPPED_LEDGER instead of fabricating one.
 */
export interface Ledger {
  remaining(cardId: string, ruleIndex: number, year: number, cap: number): number;
  consume(cardId: string, ruleIndex: number, year: number, amount: number): void;
}

/**
 * Assumes every bonus category still has headroom.
 *
 * Correct for a point-of-sale ranking, where the alternative is inventing cap
 * state. Once a transaction feed is connected, pass a real CapLedger instead.
 */
export const UNCAPPED_LEDGER: Ledger = {
  remaining: () => Number.POSITIVE_INFINITY,
  consume: () => {},
};

/** Tracks capped-rate spend so a cap is only honoured until it is exhausted. */
class CapLedger implements Ledger {
  private used = new Map<string, number>();

  /** Dollars still eligible for this rule's bonus rate in this year. */
  remaining(cardId: string, ruleIndex: number, year: number, cap: number): number {
    const key = `${cardId}:${ruleIndex}:${year}`;
    return Math.max(0, cap - (this.used.get(key) ?? 0));
  }

  consume(cardId: string, ruleIndex: number, year: number, amount: number): void {
    const key = `${cardId}:${ruleIndex}:${year}`;
    this.used.set(key, (this.used.get(key) ?? 0) + amount);
  }
}

function ruleApplies(rule: EarnRule, category: CategoryId, portalEligible: boolean): boolean {
  if (rule.viaPortal && !portalEligible) return false;
  if (rule.categories === 'all') return true;
  return rule.categories.includes(category);
}

/** The card's catch-all rate, used for spend beyond a bonus cap. */
function baseRate(card: CardSpec): number {
  const rule = card.earn.find((r) => r.categories === 'all');
  return rule?.rate ?? 1;
}

export interface Earning {
  /** Dollars of value earned. */
  value: number;
  /** Rate applied to the capped portion. */
  rate: number;
  /** True when a cap forced part of the spend down to the base rate. */
  capped: boolean;
}

/**
 * Value a single purchase on one card, consuming cap headroom as it goes.
 *
 * Picks the best applicable rule rather than the first, since catalogs list
 * overlapping rules (a card can pay 5x on portal travel and 2x on the same
 * category booked direct).
 */
export function earnOn(
  card: CardSpec,
  category: CategoryId,
  amount: number,
  ledger: Ledger,
  year: number,
  opts: Options = {},
): Earning {
  const portalEligible = opts.portalEligible ?? false;
  const cpp = cppOf(card.currency, opts.cppOverrides);
  const base = baseRate(card);

  let best: { rate: number; index: number; cap?: number } = { rate: base, index: -1 };
  card.earn.forEach((rule, index) => {
    if (!ruleApplies(rule, category, portalEligible)) return;
    if (rule.rate > best.rate) best = { rate: rule.rate, index, cap: rule.capPerYear };
  });

  if (best.index === -1 || best.cap === undefined) {
    return { value: (amount * best.rate * cpp) / 100, rate: best.rate, capped: false };
  }

  const headroom = ledger.remaining(card.id, best.index, year, best.cap);
  const atBonus = Math.min(amount, headroom);
  const atBase = amount - atBonus;
  if (atBonus > 0) ledger.consume(card.id, best.index, year, atBonus);

  return {
    value: (atBonus * best.rate * cpp) / 100 + (atBase * base * cpp) / 100,
    rate: atBonus > 0 ? best.rate : base,
    capped: atBase > 0,
  };
}

export interface RegretLine {
  transaction: Transaction;
  category: CategoryId;
  usedCardId: string;
  usedValue: number;
  bestCardId: string;
  bestValue: number;
  /** Dollars left on the table for this purchase. Never negative. */
  lost: number;
}

export interface CategoryLeak {
  category: CategoryId;
  lost: number;
  spend: number;
  /** The card that should be carrying this category. */
  bestCardId: string;
}

export interface MissedCredit {
  cardId: string;
  creditId: string;
  label: string;
  /** Dollars recoverable by moving qualifying spend onto the right card. */
  recoverable: number;
  period: string;
}

export interface Analysis {
  /** Value actually earned, given the cards used. */
  actualValue: number;
  /** Value if every purchase had gone to the best card held. */
  optimalValue: number;
  /** optimalValue - actualValue. The headline number. */
  totalLost: number;
  lines: RegretLine[];
  /** Biggest leaks first -- this is what the UI should act on. */
  leaks: CategoryLeak[];
  missedCredits: MissedCredit[];
  totalMissedCredits: number;
}

/**
 * Compare actual routing against optimal routing across a transaction feed.
 *
 * `wallet` is the set of catalog card ids the user holds. Transactions on a
 * card outside the wallet are still scored -- people link cards they have not
 * added yet -- using that card's catalog entry when we have one.
 */
export function analyze(
  transactions: Transaction[],
  wallet: string[],
  opts: Options = {},
): Analysis {
  const held = wallet.map((id) => CARDS_BY_ID[id]).filter(Boolean) as CardSpec[];
  const ordered = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  // Two independent worlds, each with its own cap state. Sharing one ledger
  // would let the actual world's spend eat the optimal world's headroom.
  const actualLedger = new CapLedger();
  const optimalLedger = new CapLedger();
  // A third, throwaway ledger for per-line "what was the best card here"
  // reporting, so probing alternatives never consumes real headroom.
  const lines: RegretLine[] = [];

  let actualValue = 0;
  let optimalValue = 0;

  for (const txn of ordered) {
    const category = categoryOf(txn);
    const year = yearOf(txn.date);

    const usedCard = CARDS_BY_ID[txn.cardId];
    const usedEarning = usedCard
      ? earnOn(usedCard, category, txn.amount, actualLedger, year, opts)
      : { value: 0, rate: 0, capped: false };
    actualValue += usedEarning.value;

    // Optimal world: price every held card against the optimal ledger without
    // consuming it, then commit only the winner.
    let bestCard: CardSpec | null = null;
    let bestValue = -1;
    for (const card of held) {
      const value = earnOnProbe(card, category, txn.amount, optimalLedger, year, opts);
      if (value > bestValue) {
        bestValue = value;
        bestCard = card;
      }
    }

    if (bestCard) {
      const committed = earnOn(bestCard, category, txn.amount, optimalLedger, year, opts);
      optimalValue += committed.value;

      lines.push({
        transaction: txn,
        category,
        usedCardId: txn.cardId,
        usedValue: usedEarning.value,
        bestCardId: bestCard.id,
        bestValue: committed.value,
        lost: Math.max(0, committed.value - usedEarning.value),
      });
    }
  }

  const leaks = summarizeLeaks(lines);
  const missedCredits = findMissedCredits(ordered, held);
  const totalMissedCredits = missedCredits.reduce((s, m) => s + m.recoverable, 0);

  return {
    actualValue,
    optimalValue,
    totalLost: Math.max(0, optimalValue - actualValue),
    lines,
    leaks,
    missedCredits,
    totalMissedCredits,
  };
}

/**
 * Value a purchase without mutating the shared ledger.
 *
 * Reads headroom from `source` without consuming any, so probing which card
 * is best never spends real cap headroom. Only the winning card is committed.
 */
function earnOnProbe(
  card: CardSpec,
  category: CategoryId,
  amount: number,
  source: Ledger,
  year: number,
  opts: Options,
): number {
  const portalEligible = opts.portalEligible ?? false;
  const cpp = cppOf(card.currency, opts.cppOverrides);
  const base = baseRate(card);

  let best: { rate: number; index: number; cap?: number } = { rate: base, index: -1 };
  card.earn.forEach((rule, index) => {
    if (!ruleApplies(rule, category, portalEligible)) return;
    if (rule.rate > best.rate) best = { rate: rule.rate, index, cap: rule.capPerYear };
  });

  if (best.index === -1 || best.cap === undefined) {
    return (amount * best.rate * cpp) / 100;
  }

  const headroom = source.remaining(card.id, best.index, year, best.cap);
  const atBonus = Math.min(amount, headroom);
  const atBase = amount - atBonus;
  return (atBonus * best.rate * cpp) / 100 + (atBase * base * cpp) / 100;
}

function summarizeLeaks(lines: RegretLine[]): CategoryLeak[] {
  const byCategory = new Map<CategoryId, { lost: number; spend: number; cards: Map<string, number> }>();

  for (const line of lines) {
    if (line.lost <= 0) continue;
    let entry = byCategory.get(line.category);
    if (!entry) {
      entry = { lost: 0, spend: 0, cards: new Map() };
      byCategory.set(line.category, entry);
    }
    entry.lost += line.lost;
    entry.spend += line.transaction.amount;
    entry.cards.set(line.bestCardId, (entry.cards.get(line.bestCardId) ?? 0) + line.lost);
  }

  return [...byCategory.entries()]
    .map(([category, e]) => ({
      category,
      lost: e.lost,
      spend: e.spend,
      bestCardId: [...e.cards.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.lost - a.lost);
}

/** Bucket key for a credit's reset period. */
function periodKey(isoDate: string, period: Credit['period']): string {
  const year = isoDate.slice(0, 4);
  const month = parseInt(isoDate.slice(5, 7), 10);
  switch (period) {
    case 'monthly': return `${year}-${String(month).padStart(2, '0')}`;
    case 'quarterly': return `${year}-Q${Math.ceil(month / 3)}`;
    case 'semiannual': return `${year}-H${month <= 6 ? 1 : 2}`;
    case 'annual': return year;
  }
}

function creditMatches(credit: Credit, txn: Transaction, category: CategoryId): boolean {
  if (credit.categories?.includes(category)) return true;
  if (credit.merchants?.some((m) => matchMerchant(m, txn.merchant).matches)) return true;
  return false;
}

/**
 * Find credits that went unused while qualifying spend sat on another card.
 *
 * This is the leak people feel worst about: paying a $695 annual fee and
 * forfeiting a monthly credit because a subscription auto-bills to the wrong
 * card. Recoverable is bounded by both the unused credit and the spend that
 * could have been moved onto it.
 */
export function findMissedCredits(transactions: Transaction[], held: CardSpec[]): MissedCredit[] {
  const out: MissedCredit[] = [];

  for (const card of held) {
    for (const credit of card.credits) {
      const buckets = new Map<string, { onCard: number; elsewhere: number }>();

      for (const txn of transactions) {
        const category = txn.categoryId ?? guessCategory(txn.merchant);
        if (!creditMatches(credit, txn, category)) continue;

        const key = periodKey(txn.date, credit.period);
        let b = buckets.get(key);
        if (!b) {
          b = { onCard: 0, elsewhere: 0 };
          buckets.set(key, b);
        }
        if (txn.cardId === card.id) b.onCard += txn.amount;
        else b.elsewhere += txn.amount;
      }

      for (const [key, b] of buckets) {
        const unused = Math.max(0, credit.amount - Math.min(credit.amount, b.onCard));
        const recoverable = Math.min(unused, b.elsewhere);
        if (recoverable > 0.01) {
          out.push({
            cardId: card.id,
            creditId: credit.id,
            label: credit.label,
            recoverable,
            period: key,
          });
        }
      }
    }
  }

  return out.sort((a, b) => b.recoverable - a.recoverable);
}
