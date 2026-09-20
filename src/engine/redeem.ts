/**
 * What is the best way to actually use these points?
 *
 * A balance is not a number, it is a range. The same 184,500 Membership
 * Rewards is $1,107 as a statement credit or $9,225 transferred into the right
 * premium-cabin award -- and the issuer's own app steers hard toward the low
 * end, because statement credits cost them least. The gap between the route
 * someone defaults to and the best route available is the biggest single
 * decision in a rewards portfolio, and almost nothing surfaces it.
 *
 * So this module reports, per program: every route, what the balance is worth
 * through each, which route most people fall into, and what choosing better
 * would be worth.
 */

import { CURRENCIES, type Currency } from '../data/currencies';
import {
  routesFor, TRANSFER_PARTNERS, type Effort, type RedemptionRoute, type TransferPartner,
} from '../data/redemptions';
import { aggregatePoints, type PointsBalance } from './points';
import type { CppOverrides } from './regret';

export interface RouteValue {
  route: RedemptionRoute;
  low: number;
  typical: number;
  high: number;
}

export interface ProgramUse {
  currency: Currency;
  amount: number;
  /** Every route, best typical value first. */
  routes: RouteValue[];
  best: RouteValue;
  /** The route most people take by default -- see pickDefault. */
  defaultRoute: RouteValue;
  /** Typical dollars gained by taking `best` over `defaultRoute`. Never negative. */
  upside: number;
  /** Where this currency can transfer, when it is transferable. */
  partners: TransferPartner[];
}

const EFFORT_ORDER: Record<Effort, number> = { instant: 0, easy: 1, work: 2 };

/**
 * The route someone lands on without thinking about it.
 *
 * Cash wins when offered: it is the default the issuer promotes and the one
 * requiring no decision. Otherwise the least effortful route, since that is
 * what a balance drifts toward. This is the baseline `upside` measures
 * against, so it has to model real behaviour rather than the worst case --
 * naming the literal worst route would overstate the gain.
 */
function pickDefault(routes: RouteValue[]): RouteValue {
  const cash = routes.find((r) => r.route.type === 'cash');
  if (cash) return cash;
  return [...routes].sort(
    (a, b) =>
      EFFORT_ORDER[a.route.effort] - EFFORT_ORDER[b.route.effort] || a.typical - b.typical,
  )[0];
}

/**
 * Value every balance through every route it can take.
 *
 * Route values use each route's own cents-per-point, not the user's valuation
 * override: a route's rate is a fact about the route, whereas the override is
 * a personal expectation used for the portfolio headline. Keeping them
 * separate stops a pessimistic override from hiding a genuinely good route.
 */
export function bestUse(balances: PointsBalance[], overrides: CppOverrides = {}): ProgramUse[] {
  const { lines } = aggregatePoints(balances, overrides);

  return lines
    .map((line): ProgramUse | null => {
      const amount = line.amount;
      const routes = routesFor(line.currency.id)
        .map((route) => ({
          route,
          low: (amount * route.cpp.low) / 100,
          typical: (amount * route.cpp.typical) / 100,
          high: (amount * route.cpp.high) / 100,
        }))
        .sort((a, b) => b.typical - a.typical);

      if (routes.length === 0) return null;

      const best = routes[0];
      const defaultRoute = pickDefault(routes);

      return {
        currency: CURRENCIES[line.currency.id],
        amount,
        routes,
        best,
        defaultRoute,
        upside: Math.max(0, best.typical - defaultRoute.typical),
        partners: TRANSFER_PARTNERS[line.currency.id] ?? [],
      };
    })
    .filter((u): u is ProgramUse => u !== null)
    .sort((a, b) => b.upside - a.upside);
}

export interface PortfolioUpside {
  /** Total if every balance takes its default route. */
  defaultTotal: number;
  /** Total if every balance takes its best route, at typical value. */
  bestTotal: number;
  /** The difference: what better redemption decisions are worth. */
  upside: number;
  /** Optimistic ceiling, using the high end of every best route. */
  bestCeiling: number;
}

export function portfolioUpside(uses: ProgramUse[]): PortfolioUpside {
  const defaultTotal = uses.reduce((s, u) => s + u.defaultRoute.typical, 0);
  const bestTotal = uses.reduce((s, u) => s + u.best.typical, 0);
  const bestCeiling = uses.reduce((s, u) => s + u.best.high, 0);
  return { defaultTotal, bestTotal, upside: Math.max(0, bestTotal - defaultTotal), bestCeiling };
}

/** Human label for how much work a route takes. */
export function effortLabel(effort: Effort): string {
  return { instant: 'Instant', easy: 'A few minutes', work: 'Takes research' }[effort];
}
