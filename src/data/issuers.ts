/**
 * Issuers and how to hand off to them for offer activation.
 *
 * Activation is the step where the money is actually won or lost. An offer
 * sitting unactivated in an issuer app pays nothing, so the fastest possible
 * path from "this card has an offer here" to the issuer's own activation
 * screen is the single most valuable interaction in the product.
 *
 * NOTE ON DEEP LINKS: the custom schemes below are best-effort and MUST be
 * verified on real devices before release -- issuers change them without
 * notice, and iOS additionally returns false from canOpenURL for any scheme
 * not declared in LSApplicationQueriesSchemes (see app.json). Every issuer
 * therefore carries a web fallback, and the handoff always degrades to it
 * rather than dead-ending the user.
 */

import type { Issuer } from './cards';

export interface IssuerInfo {
  id: Issuer;
  name: string;
  shortName: string;
  color: string;
  /** Custom scheme for the issuer's native app. Unverified -- see note above. */
  appScheme?: string;
  /** Always-works web destination for the offers page. */
  webFallback: string;
  /** What the issuer calls its offer program, shown in the UI. */
  offerProgram: string;
}

export const ISSUERS: Record<Issuer, IssuerInfo> = {
  amex: {
    id: 'amex',
    name: 'American Express',
    shortName: 'Amex',
    color: '#006FCF',
    appScheme: 'amex://',
    webFallback: 'https://www.americanexpress.com/en-us/account/offers',
    offerProgram: 'Amex Offers',
  },
  chase: {
    id: 'chase',
    name: 'Chase',
    shortName: 'Chase',
    color: '#117ACA',
    appScheme: 'chase://',
    webFallback: 'https://secure.chase.com',
    offerProgram: 'Chase Offers',
  },
  capital_one: {
    id: 'capital_one',
    name: 'Capital One',
    shortName: 'Capital One',
    color: '#D03027',
    appScheme: 'capitalone://',
    webFallback: 'https://myaccounts.capitalone.com',
    offerProgram: 'Capital One Offers',
  },
  citi: {
    id: 'citi',
    name: 'Citi',
    shortName: 'Citi',
    color: '#056DAE',
    appScheme: 'citimobile://',
    webFallback: 'https://www.citi.com',
    offerProgram: 'Citi Merchant Offers',
  },
  bofa: {
    id: 'bofa',
    name: 'Bank of America',
    shortName: 'BofA',
    color: '#E31837',
    appScheme: 'bofa://',
    webFallback: 'https://www.bankofamerica.com',
    offerProgram: 'BankAmeriDeals',
  },
  discover: {
    id: 'discover',
    name: 'Discover',
    shortName: 'Discover',
    color: '#FF6000',
    appScheme: 'discover://',
    webFallback: 'https://card.discover.com',
    offerProgram: 'Discover Deals',
  },
  wells_fargo: {
    id: 'wells_fargo',
    name: 'Wells Fargo',
    shortName: 'Wells Fargo',
    color: '#D71E28',
    webFallback: 'https://www.wellsfargo.com',
    offerProgram: 'Wells Fargo Deals',
  },
};

export const ISSUER_LIST: IssuerInfo[] = Object.values(ISSUERS);
