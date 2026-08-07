# TicketX — handoff

Last updated: 2026-08-07 (evening). Ticket-resale marketplace for St Andrews students, built on
the Sharetribe Web Template.

The spec is `user_flows.md` in Google Drive. **Four files share that name** — the current one is
`1yu6OlvB8hIYz--wYhf2EGhU4mGIWEyycUhOHWRSd794` (modified 2026-07-10). Pick by modified date, not
title. There's a condensed `user_flows_abridged` too.

Branch: `design-system-and-event-browsing`, pushed to
`git@github.com:hector78-star/ticketx-vibe.git`. **33 commits ahead of `main`, no PR opened yet,
and no code-level review has ever been run on any of it.**

Product direction was settled on 2026-08-07 by CEO, engineering and design reviews. The full
reasoning is in `~/.gstack/projects/hector78-star-ticketx-vibe/ceo-plans/2026-08-07-event-watch-and-drop-alerts.md`.
Short version: **a community layer was considered and rejected.** Forums and matchmaking were cut;
the product competes on liquidity and on not getting scammed. The one feature added is event
alerts.

---

## 1. Do this first

### Rotate five secrets

All were pasted into chat transcripts. None is committed — `.env` is gitignored and confirmed
untracked — but the transcripts are the exposure.

| Secret | Where | Action |
|---|---|---|
| **Integration API secret** `27af1de0…` | `.env`, `SHARETRIBE_INTEGRATION_CLIENT_SECRET` | **Highest priority.** Not user-scoped: reads and writes the entire marketplace as operator |
| Sharetribe Marketplace secret `f98c2af8fd…` | `.env`, `SHARETRIBE_SDK_CLIENT_SECRET` | Console → Build → Applications. Leaked twice |
| OpenAI API key `sk-proj-zlKR…` | `~/.gstack/openai.json` (chmod 600) | platform.openai.com/api-keys |
| Two unidentified 40-hex values | unknown | `30785bbc…` and `8aa1a477…` were pasted but match nothing in `.env`. Find what they belong to |

Rotating does **not** break local development or an AI agent's ability to work: the value is read
from `.env` at runtime, so replacing it there is the whole job.

### Two marketplaces with near-identical names

**This is a live trap.** There are at least two Sharetribe marketplaces:

| Name | Contents | Used by |
|---|---|---|
| **`ticketx Dev`** (lowercase t) | 42 listings, 3 users, 14 transactions | The app, the CLI (`-m ticketx1-dev`), everything |
| **`TicketX Dev`** (capital T) | completely empty | nothing — a stray |

An Integration API application was created on the empty one by mistake. It authenticated
correctly and returned 200 on every endpoint, so nothing errored; it simply saw no data. Wiring
it in would have meant a fan-out that silently never sent an alert.

**Delete or rename the empty one.** Otherwise this recurs.

### Delete the test data

Still on the marketplace:

| What | Detail |
|---|---|
| User | `claude-diag-0805@st-andrews.ac.uk` ("Diag User") |
| Events | 2 × "Claude Test Ball", "Diag Event", "Sellers Own Event", "Style Audit Ball", "hello" |
| Listings | "Diag Hoodie" (stock 0), "Style Audit Ball" £45, "Desk lamp" draft |
| Transactions | 2 × Starfields, £100 and £70, Stripe test keys. One confirmed and closed |
| Watch transaction | 1 × `default-watch` on Starfields, now `state/unwatched` (created while testing) |

**"hello" is visible on the browse page** in the "Other tickets" section, with its event name now
rendered. Sold tickets are hidden from browse as of today, but they are hidden, not deleted.

### Console-only, cannot be done from code

"YOUR LOGO" placeholder, footer slogan text, and the junk photos on several events.

---

## 2. The one thing that will actually hurt you

**The purchase process refunds the buyer after 14 days if nobody acts.** Verified in
`ext/transaction-processes/default-purchase/process.edn`, which is the authoritative definition —
`src/transactions/` only mirrors it.

- `stripe-capture-payment-intent` on `confirm-payment` — money is taken and held. Correct.
- `stripe-create-payout` on the four transitions landing in `received`. Correct.
- **`auto-cancel` at `P14D` from `purchased` → buyer refunded.** The spec says the opposite:
  auto-release to the *seller* 12h after the event.

Why it matters more than it looks: handover happens entirely in the message thread, so the app
observes nothing, and nothing prompts a seller to mark delivered. `purchased → auto-cancel → buyer
refunded` is therefore the **likely** path, not an edge case. A seller can hand over a real ticket
and lose both ticket and money.

This got worse, not better, with the alerts work. The product's whole pitch is now "you will not
get scammed here". A process that automatically refunds the buyer after a genuine handover is not
a dent in that claim, it is the claim failing, in a town with one street.

Fixing it means a custom transaction process: change `auto-cancel` to favour the seller, and add
an event-date-based timer. Sharetribe timers key off transition timepoints, not listing data, so
"12 hours after the event" needs a scheduled operator-driven transition. A drafted redesign sits
in `ext/transaction-processes/default-purchase-proposed/` with a README. **Not pushed, not
reviewed.** Hector is bringing in someone to own payments and dispute handling; that folder is
their brief.

**Note the command:** that folder would use `flex-cli process push`, which *updates* an existing
process. `process create` is for one that does not exist. Getting this backwards wastes a
deployment attempt.

Related: `auto-complete` fires *immediately* on entering `received`, so the "Receipt confirmed"
step on the sales tracker is never really seen.

Already fixed and **pushed live as v2** (`release-1` alias moved):
`:transition/dispute-from-purchased` — buyers can dispute without waiting for the seller.

---

## 3. What works today

Verified in a browser against the live marketplace, not just unit tested.

- **Browse** — `/events` grid, `/events/:slug/:id` with tickets cheapest-first. Search is by
  *event*, not by listing.
- **Listing flow** — one question per screen, five steps. See §5.
- **Buying** — full Stripe checkout completes. Two real purchases made.
- **Seller dashboard** — `/sell` hub, `/sell/listings`, `/sell/sales`.
- **Buyer** — `/my-tickets` with per-purchase status.
- **Alerts** — `/alerts`, plus the control on every event card and event page. **Watch and unwatch
  both verified end to end** with a second account: initiate → 200, state persists across reload,
  appears on `/alerts`, unwatch → 200, gone after reload.
- **Admin** — `/admin/events`, gated to `REACT_APP_ADMIN_USER_ID`.
- **Signup** — restricted to `@st-andrews.ac.uk`.

Tests: **1148 client + 184 server.** `CI=true npx jest` and
`npx jest --roots ./server --testMatch='**/server/**/*.test.js' --testEnvironment=node`.

**A small number of client tests fail intermittently, and it is a different set each time.** The
offenders are the hosted-asset tests: `LandingPage`, `PrivacyPolicyPage`, `TermsOfServicePage`
(all "renders the Fallback page on error") and `ListingPage variants › has hero section in
coverPhoto mode`. Observed on 2026-08-07: two consecutive full runs each failed a *different*
pair with no overlap, then two later runs passed 1148/1148 clean. They appear to be
network- or load-sensitive rather than order-sensitive.

**Do not bisect against a single run.** These fail *in isolation* too, not only under
parallelism, so "it passed when I stashed my change" proves nothing. A wrong root cause was
reached this way on 2026-08-07 and only caught by running the same test three times (fail, pass,
pass). Re-run at least twice before attributing a failure to your change.

An earlier version of this file named `TransactionPage`, `SearchPage` and `app.test.js`. That
list was wrong.

### What does NOT work yet

**No alert email is ever sent.** Everything up to that point is built and verified; the fan-out is
not. See §7.

---

## 4. Event alerts — how it actually works

A watch **is a transaction** against the EVENT listing, using the `default-watch` process.

That is not a flourish. A Sharetribe notification's `:to` must be `:actor.role/customer` or
`:actor.role/provider` — **the two parties of that transaction.** There is no way to email a third
party. So for the platform to email someone merely watching an event, the watcher has to be a
customer of something. That single constraint is why this design exists, and it is also why no
external email vendor is needed: Sharetribe handles SPF and DKIM for its own sends.

```
:transition/watch (customer)
      │
      ▼
:state/watching ──────┐
      │   ▲           │ :transition/ticket-dropped (operator, self-loop)
      │   └───────────┘ fires the alert email to the customer
      │
      ├── :transition/unwatch (customer)
      └── :transition/operator-unwatch (operator)   ← for account deletion
                │
                ▼
          :state/unwatched
```

**Live on `ticketx1-dev`:** `default-watch` version 1, alias `default-watch/release-1`. Created
with `flex-cli process create`. Verified by pulling it back and by rendering the email.

Four things about this that are easy to get wrong:

1. **`processAlias` is NOT bound to the listing.** The EVENT listing type stays on
   `default-inquiry`; the watch passes `default-watch/release-1` explicitly.
   `transactionProcessAlias` is a contract between listing, marketplace and client app, not
   something the API enforces. **Proven empirically**, not just from docs. Consequences: existing
   events need no migration, and events never become "transactable", so no `OrderPanel` appears on
   a catalogue page. `configListing.js` carries the same note. **Do not "fix" this.**

2. **A transaction is capped at 100 transitions.** `ticket-dropped` self-loops, so a watch on a
   busy event burns one per alert and **dies silently at the ceiling** — no error, the watcher just
   stops hearing anything. The fan-out must read `transactions.length` and re-create the watch past
   ~90. The one test watch already shows `transitions used: 2`.

3. **You cannot watch your own event.** Sharetribe returns
   `409 transaction-same-author-and-customer`. That covers the admin account, which authors every
   curated event, and any seller who added their own. `WatchButton` hides itself in that case; the
   events query now includes `author` so it can.

4. **The email carries its data as protected data.** The listing on a watch is the *event*, not the
   ticket that dropped, so `ticket-dropped` must be given `askingPrice`, `faceValue`, `eventWhen`,
   `ticketUrl` and `unwatchUrl`. Format prices with a real `£`.

---

## 5. The design system

The **homepage is the reference.** When something looks wrong elsewhere, compare it to `/`.

| | |
|---|---|
| Display | Instrument Serif, self-hosted, **weight 400 only** |
| Body | Inter |
| Accent | `#6938ef`, for the **one** primary action per screen, and for focus |
| Money | **Always Inter with tabular figures.** Instrument Serif's `£` overlaps the digit after it |
| Structure | Hairline rules. No filled cards — a card only when the card *is* the interaction |
| Labels | 13px, `0.04em` tracking, **grey600** |
| CTA | `.ctaLink` / `.ctaLinkQuiet` in `marketplaceDefaults.css` — these already carry a 44px tap target via an `::after` overlay. **Do not rebuild it.** |

**`--colorGrey500` measures 3.97:1 on white and fails WCAG AA for small text.** It is gone from
`EventsPage`, `TicketCard` and `EventStats`. **Still in use elsewhere** — check before copying any
component. Also fixed today: the "under face value" green was `#27ae60` at 2.87:1, now `#157347` at
5.87:1. `--colorFail` was measured at 4.77:1 and left alone.

**Headings are defined twice** in `marketplaceDefaults.css`: bare `h1`/`h2`/`h3` element selectors
*and* `.h1`/`.h2`/`.h3` classes. Edit one and you must edit the other.

**`composes:` does not work in `marketplaceDefaults.css`** — it is a plain global stylesheet, not a
CSS module, so the declaration is silently dropped. CSS-module files can still
`composes: ctaLink from global`.

Approved mockups, which are the reference for the alert work:

| Screen | Path under `~/.gstack/projects/hector78-star-ticketx-vibe/designs/` |
|---|---|
| Event card + stats row | `event-card-watch-20260807/variant-B.png` |
| Drop-alert email | `alert-email-20260807/variant-A.png` (with variant B's footer wording) |

The card mockup renders prices as "GBP 65" only because the image model avoids the `£` glyph. That
is a generation artifact. **Ship the pound sign.**

### The listing flow

Five steps, tickets only. Other listing types keep the stock wizard untouched.

| Step | Question | Advance | Lives in |
|---|---|---|---|
| 0 | Listing type | on select | replaced by hidden fields once chosen |
| 1 | Which event is your ticket for? | auto, on picking | Details tab |
| 2 | What kind of ticket is it? | auto, after a 250ms highlight | Details tab |
| 3 | One thing to confirm | Continue | Details tab |
| 4 | Anything the buyer should know? | Save | Details tab |
| 5 | What's your price? | Publish | **Pricing & stock** tab |

- **Tickets route to `PRICING_AND_STOCK`, not `PRICING`.** Work put into `EditListingPricingPanel`
  reaches nothing.
- **Only the visible step's fields are mounted**, so final-form's `invalid` reflects that step
  alone. `ticketFlowComplete` re-checks earlier answers on submit.
- **`ticketStep` is state, not derived from values.**
- **`PillChoice` radios are `pointer-events: none`** — the label is the click target.
- **The step question is the page `h1`.**

---

## 6. Traps in this codebase

Each of these cost real debugging time.

1. **`ownListing` vs `listing` entity types.** `ownListings.query`/`create` return `ownListing`;
   `getListingsById` builds refs of type `listing`. The lookup silently returns nothing.

2. **`transaction.attributes.processState` does not exist.** Only `lastTransition` does. Derive
   with `getProcess(processName).getState(tx)`.

3. **`pub_*` search filters are silently ignored without a server-side index.** The API accepts the
   parameter and returns everything. Always test with a deliberately *wrong* value and check you
   get zero results. `pub_eventId` **is** indexed.

4. **Sharetribe's sort convention is inverted.** A bare field name sorts DESCENDING; `-` sorts
   ASCENDING. So `-price` is "lowest first".

5. **`AUTOFILLED_TICKET_FIELDS` is a lie.** `EventPicker` writes `pub_eventTitle`, `pub_eventDate`,
   `pub_eventTime`, `pub_venue` onto the form, but those fields are configured for the EVENT
   listing type only, so the save path strips them. **Every ticket carries only `eventId`.**

6. **`transactions.query` only returns the requesting user's own transactions.** This is why the
   Integration API exists in this repo at all.

7. **Local listing types/fields are merged in code**, not Console, via
   `mergeLocalListingTypesAndFields()`. Deliberately off under test.

8. **Listing `privateData` is readable only by the listing's author** — via the Marketplace API.
   The **Integration API is different**: it can read and write any listing regardless of author.

9. **`/l/new` redirects to `/l/draft/00000000-…`.** Normal.

10. **`flex-cli process --path` validates the `.edn` but not template-directory completeness.** A
    push can succeed and ship broken email templates. Also: pushed templates use CRLF while the
    repo uses LF, so `diff -rq` reports every template as changed when nothing has. Compare with
    `diff <(tr -d '\r' < a) <(tr -d '\r' < b)`.

11. **`TICKET_LISTING_TYPE` is the string `'sell-products'`, not `'ticket'`.** "Everything else" is
    `'sell-other'`. Neither name says what it is. `server/` cannot import from `src/` — there are
    **zero** such imports — so the value is duplicated in `server/api-util/listingTypes.js` with a
    test that fails if they drift. Guess wrong and the filter matches nothing, silently.

12. **Selling a ticket does not close or delete the listing** — it drops stock to 0 and the listing
    stays published. Ticket queries need `minStock: 1` or sold tickets keep appearing at their old
    price. Fixed in `queryTicketsForEvents`, which both the event page and browse go through.

13. **`TopbarDesktop` and `TopbarMobileMenu` share no source.** Every TicketX destination was added
    to the desktop one only, so the product was unreachable on a phone for weeks. **Edit both.**

14. **A Sharetribe process cannot be deleted.** Versions only accumulate.

---

## 7. Next, roughly in order

1. **Build the alert fan-out.** The only thing standing between a working feature and a shipped
   one. Tasks E1–E7 in `~/.gstack/projects/hector78-star-ticketx-vibe/tasks-eng-review-*.jsonl`
   carry file paths and the decisions already made. In outline:
   - `POST /api/notify-watchers` — author check via `getSdk(req)`, marker write **before**
     fan-out, respond 202, then fan out detached. Never block the seller's publish.
   - Group by `eventId`; **page `transactions.query` past 100 watchers** or watcher 101 silently
     gets nothing.
   - Per-watcher try/catch — one banned account must not abort the other 499.
   - Honour the 100-transition ceiling (§4.2).
   - Hourly sweeper as the backstop for a lost client call.
   - Sentry via `server/log.js` (already wired) plus a per-run summary.
2. **Custom transaction process** — see §2. A specialist is being brought in.
3. **Rotate the secrets** and **delete the empty `TicketX Dev` marketplace** (§1).
4. **Review this branch.** 33 commits, no PR, no code-level review.
5. **Shared topbar and footer touch targets** — profile-menu links 24px, footer links 17px, both
   below the 44px minimum.
6. **Duplicate-event guard** — sellers can add events with no near-duplicate check.
7. **Quantity floor** — nothing stops a seller dropping quantity below what is already sold.
8. **Spec divergences** — the spec puts date/venue on the *listing*; this build keeps them on the
   *event*. The 80-day event-date cap (Stripe's 90-day payout ceiling) is not implemented.

### Deferred deliberately

`TODOS.md` holds three, with reasoning: the **fair-allocation claim draw** (the genuinely
differentiating idea, blocked on §2), attended-only post-event rooms, and a price ceiling on
alerts. The claim draw is the one worth protecting — the alert work already built is its substrate.

Open judgement call: the desktop wizard side nav uses Instrument Serif, the **mobile tab strip
stays in Inter.**

Not yet built from the design review: the **bottom tab bar** for mobile (Buy / Alerts / My tickets
/ Sell), the **ticket count** in "View tickets" (needs available-ticket counts plumbed to browse),
and **hairline rules between browse cards** (grid gap used instead).

---

## 8. Running it

```bash
yarn run dev          # localhost:3000, API proxy on 3500
CI=true npx jest      # 1134 client tests
npx jest --roots ./server --testMatch='**/server/**/*.test.js' --testEnvironment=node   # 184
```

`.env` needs `REACT_APP_SHARETRIBE_SDK_CLIENT_ID`, `SHARETRIBE_SDK_CLIENT_SECRET`,
`REACT_APP_STRIPE_PUBLISHABLE_KEY`, `REACT_APP_ADMIN_USER_ID`, and now
`SHARETRIBE_INTEGRATION_CLIENT_ID` / `SHARETRIBE_INTEGRATION_CLIENT_SECRET`.

**Never prefix an Integration variable with `REACT_APP_`** — that inlines it into the browser
bundle. `server/api-util/integrationSdk.js` refuses to load if you do.

Mapbox is deliberately unset; the console warning is expected.

Key files:

| Path | What |
|---|---|
| `src/styles/marketplaceDefaults.css` | The design system |
| `src/config/configListing.js` | Listing types and fields. Read the EVENT comment before changing it |
| `src/util/events.js` | Event catalogue and ticket queries |
| `src/ducks/watch.duck.js` | Alerts: watch, unwatch, pending-signup intent |
| `src/components/WatchButton/` | The alert control, shared by three surfaces |
| `src/components/EventStats/` | The stats row, shared by three surfaces |
| `server/api-util/integrationSdk.js` | Integration API client + the REACT_APP_ guard |
| `server/api-util/listingTypes.js` | Listing type ids, mirrored from `src/` with a drift test |
| `ext/transaction-processes/default-watch/` | The alert process. README carries the pre-push notes |
| `ext/transaction-processes/default-purchase-proposed/` | The payments specialist's brief |

Design artifacts, CEO plan and per-review task lists live in
`~/.gstack/projects/hector78-star-ticketx-vibe/`, **not** in this repo.
