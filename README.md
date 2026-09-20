# point

Which card do I pull out, right now, in this store?

`point` ranks the cards in your wallet by what each is actually worth at the
merchant you are standing in — combining the card's own earn rate with any
targeted offer you hold on it — then hands you off to the issuer to activate,
and tells you what your points are worth across every program.

## Navigation

Four tabs: **Home** (which card to use, right here), **Search** (find an offer
across every card), **Dashboard** (your position at a glance) and **More**
(wallet, offers, points, account).

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

## Running it on your phone

Every dependency is an Expo SDK module, so this runs in **Expo Go** — no build
step, no Apple account, no Xcode.

```bash
npm install
npx expo start
```

Install Expo Go ([iOS](https://apps.apple.com/app/expo-go/id982107779) ·
[Android](https://play.google.com/store/apps/details?id=host.exp.exponent)) and
scan the QR code in your terminal — the Camera app on iPhone, Expo Go's own
scanner on Android. Phone and computer need to be on the same Wi-Fi; if the
network isolates clients, use `npx expo start --tunnel`.

Create an account on first launch, then load the sample wallet from **More →
Wallet** to explore with data already in place.

For a standalone app you can install without Expo Go, or submit to the App
Store, use [EAS Build](https://docs.expo.dev/build/setup/) — not needed yet.

```bash
npm test         # engine unit tests
npm run typecheck
npm run logo     # regenerate icon and splash assets
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
| `src/engine/search.ts` | Incremental search across every offer |
| `src/engine/dates.ts` | Local-calendar expiry maths, shared by all callers |
| `src/auth/` | Account layer: Supabase and device-local providers |
| `supabase/migrations/` | Database schema and row-level security policies |
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

## Accounts and the server

Accounts run on **Supabase** — Postgres, auth and row-level security in one
box. Two reasons it was chosen over the alternatives: its SDK is pure
JavaScript, so **Expo Go keeps working** (Firebase's React Native SDK needs a
native module and would force dev builds immediately), and the same project
gives you the database you need to sync cards, offers and balances next.

Sign-in is **email one-time code**, not magic links. A link has to deep-link
back into the app, which is fragile under Expo Go's `exp://` URLs and breaks
differently across email clients; a typed code behaves the same everywhere.
There is no password at all — nothing to leak, nothing reused from another
site.

One flow covers both sign-up and sign-in: `signInWithOtp` creates the user if
the address is new, so there is no separate register path and no way to land on
the wrong one.

### Setting it up

1. Create a project at [supabase.com](https://supabase.com) (free tier is
   enough). Pick a region near your users.
2. **SQL Editor → New query**, paste `supabase/migrations/0001_profiles.sql`,
   and run it. That creates `public.profiles`, enables row-level security, and
   adds the triggers that keep a profile row in step with `auth.users`.
3. **Project Settings → Data API**, copy the project URL and the `anon`
   publishable key.
4. `cp .env.example .env` and paste both values in.
5. Restart the dev server with `npx expo start --clear` — env vars are inlined
   at bundle time, so a running server will not pick them up.

Without those variables the app falls back to the device-local provider and
still runs, which keeps `npx expo start` working for a fresh clone.

By default Supabase's built-in mailer is rate-limited to a handful of messages
an hour — fine for development, not for real users. Configure your own SMTP
under **Authentication → Emails** before launch.

### Security notes

The `anon` key is **publishable by design** and is meant to ship in the app.
What protects your data is row-level security, not the key's secrecy — which is
why the migration enables RLS on `profiles` before adding any policy, and why
every policy is scoped to `auth.uid() = id`. Anything prefixed
`EXPO_PUBLIC_` is inlined into the JS bundle and readable by anyone with the
app, so the `service_role` key must never appear in this project. `.env` is
gitignored.

The `handle_new_user` trigger runs `security definer` because it fires before
any session exists and so cannot pass its own RLS policies. It therefore also
sets `search_path = ''` and schema-qualifies every identifier: without that, a
caller can shadow the referenced objects and run their own code with the
definer's privileges.

### What is not synced yet

Accounts are real; **cards, offers and balances still live on the device**.
Syncing them is the obvious next step and needs a second migration with the
same RLS shape, plus a sync layer in the wallet store. The account screen says
so rather than implying your data is backed up.

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
- **Wallet data is device-local.** Accounts are on the server; cards, offers
  and balances are not synced yet, so they do not survive a reinstall.
- **Point valuations are opinions.** Defaults ship in
  `src/data/currencies.ts`; every one is user-overridable, and the whole app
  re-ranks when they change.
