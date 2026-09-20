/**
 * Rewards currencies and what a point is actually worth.
 *
 * Valuations are the hinge of every comparison in this app: "4x points" and
 * "5% back" are not comparable until points are priced. These are editable
 * defaults, not gospel — redemption value is personal (someone who only flies
 * domestic economy gets far less from a transferable point than someone
 * booking international business), so the user can override any of them and
 * the whole app re-ranks.
 */

export type CurrencyId =
  | 'cash'
  | 'amex_mr'
  | 'chase_ur'
  | 'citi_ty'
  | 'capone_miles'
  | 'bilt'
  | 'marriott'
  | 'hilton'
  | 'hyatt'
  | 'delta'
  | 'united'
  | 'aa'
  | 'southwest';

export interface Currency {
  id: CurrencyId;
  name: string;
  shortName: string;
  /**
   * Default cents per point. 1.0 means a point is worth exactly one cent,
   * which is by definition true of cash back.
   */
  defaultCpp: number;
  /** Transferable currencies are worth more because they keep optionality. */
  transferable: boolean;
  color: string;
}

export const CURRENCIES: Record<CurrencyId, Currency> = {
  cash: { id: 'cash', name: 'Cash back', shortName: 'Cash', defaultCpp: 1.0, transferable: false, color: '#3FA96A' },
  amex_mr: { id: 'amex_mr', name: 'Membership Rewards', shortName: 'MR', defaultCpp: 2.0, transferable: true, color: '#0071CE' },
  chase_ur: { id: 'chase_ur', name: 'Ultimate Rewards', shortName: 'UR', defaultCpp: 2.05, transferable: true, color: '#0F4C8C' },
  citi_ty: { id: 'citi_ty', name: 'ThankYou Points', shortName: 'TYP', defaultCpp: 1.8, transferable: true, color: '#1B5FAA' },
  capone_miles: { id: 'capone_miles', name: 'Capital One Miles', shortName: 'Miles', defaultCpp: 1.7, transferable: true, color: '#D03027' },
  bilt: { id: 'bilt', name: 'Bilt Points', shortName: 'Bilt', defaultCpp: 2.05, transferable: true, color: '#1A1A1A' },
  marriott: { id: 'marriott', name: 'Marriott Bonvoy', shortName: 'Bonvoy', defaultCpp: 0.7, transferable: false, color: '#8C2332' },
  hilton: { id: 'hilton', name: 'Hilton Honors', shortName: 'Honors', defaultCpp: 0.5, transferable: false, color: '#104C97' },
  hyatt: { id: 'hyatt', name: 'World of Hyatt', shortName: 'Hyatt', defaultCpp: 1.7, transferable: false, color: '#1C2B5A' },
  delta: { id: 'delta', name: 'Delta SkyMiles', shortName: 'SkyMiles', defaultCpp: 1.2, transferable: false, color: '#C8102E' },
  united: { id: 'united', name: 'United MileagePlus', shortName: 'MileagePlus', defaultCpp: 1.35, transferable: false, color: '#002244' },
  aa: { id: 'aa', name: 'AAdvantage', shortName: 'AAdvantage', defaultCpp: 1.4, transferable: false, color: '#0078D2' },
  southwest: { id: 'southwest', name: 'Rapid Rewards', shortName: 'Rapid Rewards', defaultCpp: 1.35, transferable: false, color: '#304CB2' },
};

export const CURRENCY_LIST: Currency[] = Object.values(CURRENCIES);

/** Dollar value of a point balance, given an optional user override. */
export function valueOfPoints(
  points: number,
  currencyId: CurrencyId,
  overrides: Partial<Record<CurrencyId, number>> = {},
): number {
  const cpp = overrides[currencyId] ?? CURRENCIES[currencyId].defaultCpp;
  return (points * cpp) / 100;
}
