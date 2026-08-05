# TicketX — handoff

Last updated: 2026-08-05. Ticket-resale marketplace for St Andrews students, built on the
Sharetribe Web Template.

The spec is `user_flows.md` in Google Drive. **Four files share that name** — the current one is
`1yu6OlvB8hIYz--wYhf2EGhU4mGIWEyycUhOHWRSd794` (modified 2026-07-10). Pick by modified date, not
title. There's a condensed `user_flows_abridged` too.

---

## 1. Do this first

### Delete the test data

Created while diagnosing bugs that couldn't be reproduced logged-out. All of it is on the live
marketplace:

| What | Detail |
|---|---|
| User | `claude-diag-0805@st-andrews.ac.uk` ("Diag User") |
| Events | 2 × "Claude Test Ball", "Diag Event", "Sellers Own Event" |
| Listing | "Diag Hoodie" (stock 0) |
| Transactions | 2 × Starfields, £100 and £70, Stripe test keys. One confirmed and closed. |

### Rotate the Sharetribe client secret

`f98c2af8fd…` was pasted into a chat transcript. It lives in `.env` (correctly gitignored, never
committed). Regenerate in Console → Build → Applications.

---

## 2. The one thing that will actually hurt you

**The transaction process refunds the buyer after 14 days if nobody acts.** Verified in
`ext/transaction-processes/default-purchase/process.edn`, which is the authoritative definition —
`src/transactions/` only mirrors it.

- `stripe-capture-payment-intent` on `confirm-payment` — money is taken and held. Correct.
- `stripe-create-payout` on the four transitions landing in `received`. Correct.
- **`auto-cancel` at `P14D` from `purchased` → buyer refunded.** The spec says the opposite:
  auto-release to the *seller* 12h after the event.
- `dispute` is only reachable from `delivered`, so if a seller never marks delivered the buyer
  cannot dispute at all.

Why it matters more than it looks: handover happens entirely in the message thread, so the app
observes nothing, and nothing prompts a seller to mark delivered. `purchased → auto-cancel → buyer
refunded` is therefore the **likely** path, not an edge case. A seller can hand over a real ticket
and lose both ticket and money, with no way to contest it.

Fixing it means a custom transaction process: change `auto-cancel` to favour the seller, and add an
event-date-based timer. Sharetribe timers key off transition timepoints, not listing data, so
"12 hours after the event" needs a scheduled operator-driven transition. **This requires
`flex-cli process push` — editing the `.edn` in this repo changes nothing on its own.**

Related: `auto-complete` fires *immediately* on entering `received`, so the "Receipt confirmed"
step (66% on the sales tracker) is never really seen. Add a delay there if you want that state to
be meaningful.

---

## 3. What works today

Verified end to end in a browser against the live marketplace, not just unit tested.

- **Browse** — `/events` grid, `/events/:slug/:id` with tickets cheapest-first, `Tickets` and
  `Marketplace` tabs (both `/s/:listingType`).
- **Listing creation** — staged: pick event → ticket type → attestation → description. Fuzzy event
  search; sellers can add a missing event inline (publishes immediately, `curated: false`).
- **Buying** — full Stripe checkout completes. Two real purchases made.
- **Seller dashboard** — `/sell` hub, `/sell/listings` (inline price/quantity edit, remove),
  `/sell/sales` (progress tracker, rating, verified status).
- **Buyer** — `/my-tickets` with per-purchase status.
- **Admin** — `/admin/events`, gated to `REACT_APP_ADMIN_USER_ID`.
- **Signup** — restricted to `@st-andrews.ac.uk`; username derived from the email prefix.

Tests: 1070 passing. Run with `CI=true npx jest --silent --maxWorkers=2` — full parallelism makes
several suites flake on timeouts in this environment, which is not a real failure.

---

## 4. Traps in this codebase

Each of these cost real debugging time. They will bite again.

1. **`ownListing` vs `listing` entity types.** `ownListings.query`/`create` return entities of type
   `ownListing`; `getListingsById` builds refs of type `listing`. The lookup silently returns
   nothing. Caused a newly created event to vanish from the picker, and Current listings to render
   empty. Use `getMarketplaceEntities` with the right type.

2. **`transaction.attributes.processState` does not exist.** Only `lastTransition` does. Derive
   state with `getProcess(processName).getState(tx)` — see `src/util/sellerStats.js`. String
   matching on transition names gets `auto-complete` and `mark-received-from-disputed` wrong.

3. **`pub_*` search filters are silently ignored without a server-side index.** The API accepts the
   parameter and returns everything. Always test with a deliberately *wrong* value and check you
   get zero results. `queryTicketsForEvent` in `src/util/events.js` filters client-side for exactly
   this reason (capped at 5 × 100 tickets — replace with a real index before volume).

4. **Local listing types/fields are merged in code**, not Console, via
   `mergeLocalListingTypesAndFields()` in `src/util/configHelpers.js`. Deliberately off under test,
   because `testHelpers.js` supplies its own fixtures. Any restriction keyed to hardcoded listing
   type ids must fall back to showing what's configured, or the UI ends up with no options at all.

5. **Listing `privateData` is readable only by the listing's author.** The server can't read it
   either — the trusted SDK still acts as the requesting user, and there's no Integration API.

6. **`/l/new` redirects to `/l/draft/00000000-…`.** That URL change is normal, not a stray form
   submit. (I misread it as one and "fixed" the wrong thing.)

---

## 5. Next, roughly in order

1. **Custom transaction process** — see §2. Everything else is cosmetic next to this.
2. **Stripe payout onboarding** — `hrob1` has a test payout account connected and the template
   ships Connect onboarding at `/account/payments`. What's missing is spec flow 5.2: choosing
   between several saved payout accounts, and the return-to-listing-creation path.
3. **Search index on `eventId`** — replaces the client-side scan in `queryTicketsForEvent`. Needs
   Sharetribe CLI or Console.
4. **Duplicate-event guard** — sellers can add events freely and there's no near-duplicate check.
   Two identical "Claude Test Ball" entries were created by accident.
5. **Quantity floor** — Current listings can't stop a seller dropping quantity below what's already
   sold, because Sharetribe stock only tracks what remains. Setting 0 stops further sales, which is
   sane, but isn't the guard the spec describes.
6. **Spec divergences** — the spec puts date/venue on the *listing*; this build keeps them on the
   *event*. The 80-day event-date cap (Stripe's 90-day payout ceiling) isn't implemented.

---

## 6. Running it

```bash
yarn run dev          # localhost:3000, API proxy on 3500
```

`.env` needs `REACT_APP_SHARETRIBE_SDK_CLIENT_ID`, `SHARETRIBE_SDK_CLIENT_SECRET`,
`REACT_APP_STRIPE_PUBLISHABLE_KEY`, and `REACT_APP_ADMIN_USER_ID` (the account that curates events
and sees `/admin/events`). Mapbox is deliberately unset — search is keyword-based, and the console
warning about missing map tokens is expected.

Key files: `src/config/configListing.js` (listing types and fields), `src/util/events.js` (event
catalog queries), `src/util/sellerStats.js` (reputation and transaction status),
`src/hooks/useEventImages.js` (tickets borrow the event's photo everywhere).
