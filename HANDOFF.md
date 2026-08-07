# TicketX — handoff

Last updated: 2026-08-07. Ticket-resale marketplace for St Andrews students, built on the
Sharetribe Web Template.

The spec is `user_flows.md` in Google Drive. **Four files share that name** — the current one is
`1yu6OlvB8hIYz--wYhf2EGhU4mGIWEyycUhOHWRSd794` (modified 2026-07-10). Pick by modified date, not
title. There's a condensed `user_flows_abridged` too.

Branch: `design-system-and-event-browsing`, pushed to
`git@github.com:hector78-star/ticketx-vibe.git`. 18 commits ahead of `main`, no PR opened yet.

---

## 1. Do this first

### Rotate two secrets

Both were pasted into chat transcripts.

| Secret | Where | Action |
|---|---|---|
| Sharetribe client secret `f98c2af8fd…` | `.env` (gitignored, never committed) | Console → Build → Applications |
| OpenAI API key `sk-proj-zlKR…` | `~/.gstack/openai.json` (chmod 600) | platform.openai.com/api-keys |

### Delete the test data

All of it is on the live marketplace:

| What | Detail |
|---|---|
| User | `claude-diag-0805@st-andrews.ac.uk` ("Diag User") |
| Events | 2 × "Claude Test Ball", "Diag Event", "Sellers Own Event", "Style Audit Ball", "hello" |
| Listings | "Diag Hoodie" (stock 0), "Style Audit Ball" £45, "Desk lamp" draft |
| Transactions | 2 × Starfields, £100 and £70, Stripe test keys. One confirmed and closed. |

"Style Audit Ball", "Desk lamp" and "hello" came from walking the listing flow on 2026-08-06/07.

### Console-only, cannot be done from code

"YOUR LOGO" placeholder, footer slogan text, and the junk photos on several events.

---

## 2. The one thing that will actually hurt you

**The transaction process refunds the buyer after 14 days if nobody acts.** Verified in
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

Fixing it means a custom transaction process: change `auto-cancel` to favour the seller, and add an
event-date-based timer. Sharetribe timers key off transition timepoints, not listing data, so
"12 hours after the event" needs a scheduled operator-driven transition. **This requires
`flex-cli process push` — editing the `.edn` in this repo changes nothing on its own.**

A drafted redesign sits in `ext/transaction-processes/default-purchase-proposed/` with a README
explaining the operator-authorised payout model. **Not pushed. Not reviewed.** Hector is bringing in
someone to own payments and dispute handling; that folder is the brief for them.

Related: `auto-complete` fires *immediately* on entering `received`, so the "Receipt confirmed" step
on the sales tracker is never really seen. Add a delay if you want that state to be meaningful.

Already fixed and **pushed live as v2** (`release-1` alias moved):
`:transition/dispute-from-purchased` — buyers can now dispute without waiting for the seller to mark
delivered.

---

## 3. What works today

Verified end to end in a browser against the live marketplace, not just unit tested.

- **Browse** — `/events` grid, `/events/:slug/:id` with tickets cheapest-first, `Tickets` and
  `Marketplace` tabs. Search is by *event*, not by listing.
- **Listing flow** — one question per screen, five steps. See §4.
- **Buying** — full Stripe checkout completes. Two real purchases made.
- **Seller dashboard** — `/sell` hub, `/sell/listings`, `/sell/sales` (payout progress bar, seller
  rating, verified status).
- **Buyer** — `/my-tickets` with per-purchase status.
- **Admin** — `/admin/events`, gated to `REACT_APP_ADMIN_USER_ID`.
- **Signup** — restricted to `@st-andrews.ac.uk`; username derived from the email prefix.

Tests: **1134 passing.** `CI=true npx jest`. `TransactionPage`, `SearchPage` and `app.test.js`
occasionally fail in a full parallel run and pass in isolation — an environment artifact, not a real
failure. Re-run before believing it.

---

## 4. The design system

The **homepage is the reference.** When something looks wrong elsewhere, compare it to `/` and
match that, not the template.

| | |
|---|---|
| Display | Instrument Serif, self-hosted, **weight 400 only** — asking for bold gets a synthesised fake bold |
| Body | Inter |
| Accent | `#6938ef`, for the one primary action per screen, and for focus |
| Money | **Always Inter with tabular figures.** Instrument Serif's `£` overlaps the digit after it at every kerning, tracking and feature setting tested. It is the glyph. This is a sterling marketplace, so the display face can never carry a price. |
| Structure | Hairline rules. No filled cards — a card only when the card *is* the interaction |
| Fields | One bottom rule, transparent background, no box, no radius |
| Labels | 13px, `0.04em` tracking, grey600 |
| CTA | `.ctaLink` / `.ctaLinkQuiet` in `marketplaceDefaults.css` — small, uppercase, tracked, one hairline underline |

**Headings are defined twice** in `src/styles/marketplaceDefaults.css`: bare `h1`/`h2`/`h3` element
selectors *and* `.h1`/`.h2`/`.h3` classes used by the `H1`/`Heading` components. Edit one and you
must edit the other, or pages render two heading systems at once. This already happened once.

**`composes:` does not work in `marketplaceDefaults.css`.** It is a plain global stylesheet, not a
CSS module, so the declaration is silently dropped and the rule renders as a bare browser default.
Tokens defined there must spell out every property literally. CSS-module files can still
`composes: ctaLink from global`.

`--colorGrey500` measures **3.97:1 on white** and fails WCAG AA for small text. Replaced with
grey600 wherever the design pass touched, but it is still in use elsewhere.

### The listing flow

Five steps, tickets only. Other listing types keep the stock wizard untouched.

| Step | Question | Advance | Lives in |
|---|---|---|---|
| 0 | Listing type | on select | replaced by hidden fields once chosen; step 1's Back clears it |
| 1 | Which event is your ticket for? | auto, on picking | Details tab |
| 2 | What kind of ticket is it? | auto, after a 250ms highlight | Details tab |
| 3 | One thing to confirm | Continue | Details tab |
| 4 | Anything the buyer should know? | Save | Details tab |
| 5 | What's your price? | Publish | **Pricing & stock** tab |

Things that are easy to get wrong here:

- **Tickets route to `PRICING_AND_STOCK`, not `PRICING`.** They run on `default-purchase`. Step 5
  work put into `EditListingPricingPanel` reaches nothing.
- **Only the visible step's fields are mounted**, so final-form's `invalid` reflects that step
  alone. `ticketFlowComplete` in `EditListingDetailsForm.js` re-checks the earlier answers on
  submit, or an unattested ticket slips through.
- **`ticketStep` is state, not derived from values.** Deriving it would bounce a seller forward the
  moment they pressed Back.
- **`PillChoice` radios are `pointer-events: none`** — the label is the click target. Real users are
  fine; automation that clicks the input does nothing.
- **The step question is the page `h1`** (`as="h1"`), because the panel hides its own heading. If
  you re-show the panel heading, drop this or you get two h1s.

---

## 5. Traps in this codebase

Each of these cost real debugging time. They will bite again.

1. **`ownListing` vs `listing` entity types.** `ownListings.query`/`create` return entities of type
   `ownListing`; `getListingsById` builds refs of type `listing`. The lookup silently returns
   nothing. Caused a newly created event to vanish from the picker.

2. **`transaction.attributes.processState` does not exist.** Only `lastTransition` does. Derive
   state with `getProcess(processName).getState(tx)` — see `src/util/sellerStats.js`.

3. **`pub_*` search filters are silently ignored without a server-side index.** The API accepts the
   parameter and returns everything. Always test with a deliberately *wrong* value and check you get
   zero results. `pub_eventId` **is** indexed now (verified both ways).

4. **Sharetribe's sort convention is inverted.** A bare field name sorts DESCENDING; the `-` prefix
   sorts ASCENDING. So `-price` is "lowest first" and `-pub_eventDate` is "soonest first".

5. **`AUTOFILLED_TICKET_FIELDS` is a lie.** `EventPicker` writes `pub_eventTitle`, `pub_eventDate`,
   `pub_eventTime`, `pub_venue` onto the form, but those fields are configured for the EVENT listing
   type only, so the save path strips them. **Every ticket carries only `eventId`.** Resolve through
   `useTicketEvent` — which is the better answer anyway, since an admin correcting a venue would
   otherwise leave a stale copy on every ticket already listed.

6. **`transactions.query` only returns the requesting user's own transactions.** Another seller's
   completed-sales count is not obtainable client-side. Worked around by having each seller's own
   client publish their stats to their profile `publicData`.

7. **Local listing types/fields are merged in code**, not Console, via
   `mergeLocalListingTypesAndFields()`. Deliberately off under test.

8. **Listing `privateData` is readable only by the listing's author.** The server can't read it
   either — the trusted SDK still acts as the requesting user.

9. **`/l/new` redirects to `/l/draft/00000000-…`.** Normal, not a stray form submit.

10. **`flex-cli process --path` validates the `.edn` but not template-directory completeness.** A
    push can succeed and ship broken email templates. Sync the repo to deployed before pushing, or
    you silently revert live template fixes.

---

## 6. Next, roughly in order

1. **Custom transaction process** — see §2. Everything else is cosmetic next to this. A specialist
   is being brought in; `default-purchase-proposed/README.md` is their brief.
2. **Checkout has never been walked in a browser.** It needs a second account to buy with, and the
   only signed-in dev account owns every listing. Build one.
3. **Listing page content** — the type and colour are on-system, but *what* a ticket listing shows
   and in what order has never been through design. It still offers a photo gallery for a ticket
   with no photo, and shows no event date or venue. Run `/design-shotgun` on it.
4. **Shared topbar and footer touch targets** — profile-menu links are 24px tall, footer links 17px.
   Both below the 44px minimum, both shared across every page.
5. **Duplicate-event guard** — sellers can add events freely with no near-duplicate check. Two
   identical "Claude Test Ball" entries already exist.
6. **Quantity floor** — Current listings can't stop a seller dropping quantity below what's already
   sold; Sharetribe stock only tracks what remains.
7. **Spec divergences** — the spec puts date/venue on the *listing*; this build keeps them on the
   *event*. The 80-day event-date cap (Stripe's 90-day payout ceiling) isn't implemented.

Open judgement call: the desktop wizard side nav uses Instrument Serif, the **mobile tab strip stays
in Inter**. The serif at 13px with negative tracking reads muddy and a compact tab bar is a
different job from a side nav. Reverse it if you disagree.

---

## 7. Running it

```bash
yarn run dev          # localhost:3000, API proxy on 3500
CI=true npx jest      # 1134 tests
```

`.env` needs `REACT_APP_SHARETRIBE_SDK_CLIENT_ID`, `SHARETRIBE_SDK_CLIENT_SECRET`,
`REACT_APP_STRIPE_PUBLISHABLE_KEY`, and `REACT_APP_ADMIN_USER_ID` (the account that curates events
and sees `/admin/events`). Mapbox is deliberately unset — search is keyword-based, and the console
warning about missing map tokens is expected.

Key files:

| Path | What |
|---|---|
| `src/styles/marketplaceDefaults.css` | The design system. Type scale, field primitives, CTA tokens |
| `src/config/configListing.js` | Listing types and fields |
| `src/util/events.js` | Event catalogue queries |
| `src/util/sellerStats.js` | Reputation and transaction status |
| `src/hooks/useTicketEvent.js` | Resolves a ticket's event through `eventId` |
| `.../EditListingWizard/ListingStepChrome.js` | The listing flow's step frame |
| `.../EditListingWizard/ListingSummary.js` | Step 5's recap |

Design artifacts (mockups, approved variants, audit reports) live in
`~/.gstack/projects/sharetribe-web-template/designs/`, **not** in this repo. The approved sell-flow
and checkout directions and the 2026-08-07 design audit are all there.
