/**
 * Persisted wallet: the cards held, the offers known, and point balances.
 *
 * Point balances are entered by hand. No aggregator exposes rewards balances
 * -- Plaid, MX and Finicity all return transactions and liabilities but no
 * loyalty data -- so the honest options are manual entry or an integration
 * with a loyalty aggregator. Each balance therefore carries the date it was
 * confirmed, and the UI surfaces staleness rather than implying it is live.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { UserOffer } from '../engine/atStore';
import type { PointsBalance } from '../engine/points';
import type { CppOverrides } from '../engine/regret';
import type { CurrencyId } from '../data/currencies';

interface WalletState {
  cards: string[];
  offers: UserOffer[];
  balances: PointsBalance[];
  cppOverrides: CppOverrides;
  /** False until the persisted state has been read back from disk. */
  hydrated: boolean;

  addCard: (cardId: string) => void;
  removeCard: (cardId: string) => void;
  addOffer: (offer: Omit<UserOffer, 'id' | 'addedAt'>) => void;
  removeOffer: (offerId: string) => void;
  setActivated: (offerId: string, activated: boolean) => void;
  setBalance: (currencyId: CurrencyId, amount: number) => void;
  setCpp: (currencyId: CurrencyId, cpp: number | undefined) => void;
  loadDemo: () => void;
  reset: () => void;
}

const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Sample wallet so the flow is explorable before any real data is entered.
 * Offers here are illustrative, not real targeted offers.
 */
const DEMO: Pick<WalletState, 'cards' | 'offers' | 'balances'> = {
  cards: ['amex_gold', 'amex_platinum', 'chase_csp', 'capone_savor'],
  offers: [
    {
      id: 'demo-mango', cardId: 'amex_gold', merchant: 'Mango', kind: 'percent',
      percentBack: 20, maxBack: 30, expiresAt: '2026-12-31',
      activated: false, source: 'manual', addedAt: '2026-09-01',
    },
    {
      id: 'demo-mango-csp', cardId: 'chase_csp', merchant: 'MANGO USA', kind: 'spend_get',
      minSpend: 75, amountBack: 15, expiresAt: '2026-11-15',
      activated: true, source: 'manual', addedAt: '2026-09-01',
    },
    {
      id: 'demo-sweetgreen', cardId: 'amex_platinum', merchant: 'SQ *SWEETGREEN', kind: 'spend_get',
      minSpend: 25, amountBack: 5, expiresAt: '2026-10-05',
      activated: false, source: 'manual', addedAt: '2026-09-10',
    },
    {
      id: 'demo-nike', cardId: 'capone_savor', merchant: 'Nike', kind: 'percent',
      percentBack: 10, maxBack: 25, expiresAt: '2026-10-02',
      activated: false, source: 'manual', addedAt: '2026-09-12',
    },
  ],
  balances: [
    { currencyId: 'amex_mr', amount: 184_500, updatedAt: '2026-09-14' },
    { currencyId: 'chase_ur', amount: 62_300, updatedAt: '2026-09-02' },
    { currencyId: 'cash', amount: 4_120, updatedAt: '2026-09-14' },
    { currencyId: 'hilton', amount: 96_000, updatedAt: '2026-06-30' },
  ],
};

export const useWallet = create<WalletState>()(
  persist(
    (set) => ({
      cards: [],
      offers: [],
      balances: [],
      cppOverrides: {},
      hydrated: false,

      addCard: (cardId) =>
        set((s) => (s.cards.includes(cardId) ? s : { cards: [...s.cards, cardId] })),

      removeCard: (cardId) =>
        set((s) => ({
          cards: s.cards.filter((c) => c !== cardId),
          // Offers belong to a card; keeping them would rank a card the user
          // no longer holds.
          offers: s.offers.filter((o) => o.cardId !== cardId),
        })),

      addOffer: (offer) =>
        set((s) => ({ offers: [...s.offers, { ...offer, id: newId(), addedAt: today() }] })),

      removeOffer: (offerId) => set((s) => ({ offers: s.offers.filter((o) => o.id !== offerId) })),

      setActivated: (offerId, activated) =>
        set((s) => ({
          offers: s.offers.map((o) => (o.id === offerId ? { ...o, activated } : o)),
        })),

      setBalance: (currencyId, amount) =>
        set((s) => {
          const rest = s.balances.filter((b) => b.currencyId !== currencyId);
          if (amount <= 0) return { balances: rest };
          return { balances: [...rest, { currencyId, amount, updatedAt: today() }] };
        }),

      setCpp: (currencyId, cpp) =>
        set((s) => {
          const next = { ...s.cppOverrides };
          if (cpp === undefined) delete next[currencyId];
          else next[currencyId] = cpp;
          return { cppOverrides: next };
        }),

      loadDemo: () => set({ ...DEMO }),
      reset: () => set({ cards: [], offers: [], balances: [], cppOverrides: {} }),
    }),
    {
      name: 'point-wallet-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        cards: s.cards,
        offers: s.offers,
        balances: s.balances,
        cppOverrides: s.cppOverrides,
      }),
      // Mark hydrated either way: a read failure (first launch, cleared
      // storage, a denied disk) must still let the app render rather than
      // leaving it stuck on a loading state forever.
      onRehydrateStorage: () => () => {
        useWallet.setState({ hydrated: true });
      },
    },
  ),
);
