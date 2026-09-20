# point

Which card do I pull out, right now, in this store?

`point` ranks the cards in your wallet by what each is actually worth at the
merchant you are standing in — combining the card's own earn rate with any
targeted offer you hold on it — then hands you off to the issuer to activate,
and tells you what your points are worth across every program.

## The flow

1. **Walk in.** Type the store (or pull a guess from GPS) and roughly what you
   are about to spend.
2. **See which card wins.** Every card is priced for this merchant and basket:
   earn rate plus offer, in dollars.
3. **Activate.** An offer pays nothing until it is enrolled in the issuer's app.
   One tap opens the issuer and marks it activated.
4. **Check your points.** All programs pooled and valued in dollars.
5. **Use them well.** Every redemption route ranked, so the balance you were
   about to cash out at 0.6¢ gets compared against what it is actually worth.

## Running it

```bash
npm install
npx expo start
```

The offer-import and location features use native modules, so they need an
[EAS development build](https://docs.expo.dev/develop/development-builds/introduction/)
rather than Expo Go. Load the sample wallet from the Wallet tab to explore the
flow without entering real data.

```bash
npm test         # engine unit tests
npm run typecheck
```

## How it is put together

The domain logic is pure TypeScript under `src/`, independent of React Native
and fully unit tested. The UI in `app/` is a thin layer over it.

| Module | Responsibility |
| --- | --- |
| `src/engine/merchant.ts` | Merchant identity across issuers and OCR noise |
| `src/engine/parseOffer.ts` | Issuer offer text → structured terms |
| `src/engine/atStore.ts` | Rank the wallet for a merchant and basket |
| `src/engine/regret.ts` | What optimal routing would have earned, and missed credits |
| `src/engine/points.ts` | Pool and value balances across programs |
| `src/engine/redeem.ts` | Rank redemption routes and price the decision |
| `src/data/*` | Curated cards, categories, currencies, issuers |

A few decisions worth knowing about, because they are easy to get wrong:

**Merchant names must collapse across issuers.** Amex writes
`SQ *SWEETGREEN #1234`, Chase writes `sweetgreen.com`. Without normalization,
cross-card offer matching silently does nothing. Matching runs in three tiers —
exact, guarded containment, then edit distance for OCR damage. Containment is
suppressed when the extra tokens are brand-forming, so an Uber Eats offer never
fires on an Uber ride.

**Offer grammar decides which number is which.** Amex says "Spend $100, get $25
back"; Chase says "$5 back on $25+". The threshold and the payout appear in
opposite orders, so the parser reads the grammar rather than assuming the
larger number is the threshold — which inverts on equal-value promos.

**Offers stack with earn rates, but not with each other.** A purchase earns
points *and* triggers a statement credit, so both count. But it goes on exactly
one card, so offers on different cards never combine. That asymmetry is why
this is a per-card ranking rather than a sum.

**Portal-only rates are excluded by default.** Venture X pays 10x on hotels
booked through Capital One Travel, not at the front desk. Counting portal rates
at the register invents value that was never available.

**A balance is a range, not a number.** The same 184,500 Membership Rewards is
$1,107 as a statement credit or $9,225 transferred into the right premium-cabin
award — and the issuer's own app steers toward the low end, because statement
credits cost them least. So redemption routes are ranked with the route most
people default to marked explicitly, and the gap between that and the best
route is reported as a dollar figure. Fixed routes (cash, portal) carry exact
rates; transfer routes carry ranges, because award pricing is dynamic and a
single number would be false precision.

**Bonus categories have annual caps.** Amex Gold pays 4x on dining only to
$50k/yr. The regret engine consumes caps against a ledger in date order; the
at-register ranking cannot know how much of a cap is spent and says so
(`UNCAPPED_LEDGER`).

## Known limits

These are deliberate, and each is the honest state of the art rather than a
missing feature:

- **Card terms need verification.** Issuers change earn rates and credits
  continuously, and a stale rate produces confidently wrong dollar figures.
  Every entry in `src/data/cards.ts` carries an `asOf` date and must be checked
  against issuer terms before release.
- **Offers are entered by hand.** No issuer publishes an API for targeted
  offers, and no aggregator (Plaid, MX, Finicity) exposes them. The legitimate
  automation paths are a browser extension reading the user's own authenticated
  issuer session, a forwarding address for issuer offer email, or becoming an
  offer source via card-linking.
- **Point balances are entered by hand,** for the same reason — no aggregator
  returns loyalty balances. Each balance records when it was confirmed and the
  UI surfaces staleness rather than implying it is live.
- **Activation cannot be verified.** Nothing outside the issuer's app can
  confirm enrolment, so activation is marked optimistically and stays
  togglable.
- **Merchant detection from GPS is approximate.** Reverse geocoding returns an
  address and only sometimes a point-of-interest name. Identifying "the Mango
  in this mall" needs a places provider.
- **Transfer partners and ratios change** without much notice, and transfers
  are irreversible. `PARTNERS_AS_OF` in `src/data/redemptions.ts` records when
  the snapshot was taken; verify before moving points.
- **Point valuations are opinions.** Defaults ship in
  `src/data/currencies.ts`; every one is user-overridable, and the whole app
  re-ranks when they change.
