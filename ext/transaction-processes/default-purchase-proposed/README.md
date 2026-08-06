# Proposed purchase process — NOT DEPLOYED

**Status: draft. Do not push this without doing the app-side work in §6 first.**

`ext/transaction-processes/default-purchase/` is the real one and matches deployed
`default-purchase` **version 2**, which the `release-1` alias points at (verified with
`flex-cli process pull` + structural diff, 2026-08-06). This folder is a proposal that changes who
is allowed to move money. Payment and dispute handling are being handed to a specialist; this
document is the handover.

**Careful when diffing against a pulled process.** `process push` stores email templates with CRLF
line endings, while the repo uses LF, so a plain `diff -rq` against a freshly pulled copy reports
all 25 templates as different when nothing has actually changed. Compare with
`diff <(tr -d '\r' < a) <(tr -d '\r' < b)` before believing it.

Validate either folder without touching the marketplace or logging in:

```bash
yarn process:validate            # the deployed one
yarn process:validate:proposed   # this proposal
```

Note that `flex-cli process --path` validates the `.edn` only. It does **not** check that each
template directory contains both `<name>-subject.txt` and `<name>-html.html` — a process can
validate and still fail to push. Check template completeness separately.

---

## 1. The bug that motivated this

The deployed process contains:

```clojure
{:name :transition/auto-cancel
 :at {:fn/plus [{:fn/timepoint [:time/first-entered-state :state/purchased]}
                {:fn/period ["P14D"]}]}
 :actions [... :action/stripe-refund-payment ...]
 :from :state/purchased :to :state/canceled}
```

14 days after purchase, if nobody has clicked anything, **the buyer is refunded**. The spec calls for
the opposite: release to the seller 12 hours after the event.

This matters more than it looks. Ticket handover happens entirely in the message thread, so the app
observes nothing, and nothing prompts a seller to mark delivered. `purchased → auto-cancel → buyer
refunded` is therefore the *likely* path, not an edge case. A seller can hand over a real ticket and
lose both the ticket and the money, with no way to contest it — `:transition/dispute` is only
reachable from `:state/delivered`.

## 2. Who can move money — deployed vs proposed

Deployed:

| Actor | Transition | Money |
|---|---|---|
| customer | `confirm-payment` | capture from buyer |
| system | `expire-payment` | refund buyer (abandoned checkout, 15 min) |
| **customer** | **`mark-received-from-purchased`** | **payout → seller** |
| **customer** | **`mark-received`** | **payout → seller** |
| **system** | **`auto-mark-received`** (P14D) | **payout → seller** |
| **system** | **`auto-cancel`** (P14D) | **refund buyer** ← the bug |
| operator | `mark-received-from-disputed` | payout → seller |
| operator | `cancel`, `cancel-from-disputed` | refund buyer |
| system | `auto-cancel-from-disputed` (P60D) | refund buyer |

Proposed — every payout and every discretionary refund is operator-only:

| Actor | Transition | Money |
|---|---|---|
| customer | `confirm-payment` | capture from buyer |
| system | `expire-payment` | refund buyer (abandoned checkout, 15 min) |
| operator | `operator-release-payout` | payout → seller |
| operator | `operator-refund-from-payout-pending` | refund buyer |
| operator | `mark-received-from-disputed` | payout → seller |
| operator | `cancel`, `cancel-from-disputed` | refund buyer |
| system | `auto-cancel-from-disputed` (P60D) | refund buyer |

## 3. What the proposal changes

- **New state `:state/payout-pending`** between confirmation and payment. Reached by the buyer
  confirming receipt (from `purchased` or `delivered`), or by a timer. Left only by one of three
  operator transitions: release the payout, refund the buyer instead, or open a dispute.
- **`stripe-create-payout` removed from every customer and system transition.** Confirming receipt
  now moves no money; it signals the operator.
- **`auto-cancel` deleted, replaced by `auto-payout-review`** — same 14-day timer from `purchased`,
  but it moves the sale into the operator queue instead of refunding. No money moves; a human decides.
- **`auto-mark-received` (P14D from `delivered`) keeps its timer but drops its payout action.** It is
  now a safety net so a seller isn't stranded by a buyer who never clicks.
- **New `:transition/dispute-from-purchased`** (customer, `purchased → disputed`) so a buyer can
  contest before the seller has marked delivery. This closes the "cannot dispute at all" gap.
- **Email correction.** The `purchase-order-marked-as-received` template says *"We sent you a
  payment"* and was firing when the buyer confirmed — before any money moved. It now fires on
  `operator-release-payout`. Buyer confirmation sends a new `purchase-receipt-confirmed` template
  ("your payout is being reviewed").

## 4. Constraints discovered — read before redesigning

1. **The process cannot notify the operator.** A notification's `:to` accepts only
   `:actor.role/customer` or `:actor.role/provider`. There is no operator option. So "tell me I need
   to pay out seller X" cannot be an email from the process. It has to be Console, an in-app admin
   queue, or an Integration API / Zapier job.
2. **Stripe holds funds for 90 days maximum.** A sale parked in `payout-pending` past that cannot be
   paid out at all. Anything that queues payouts for human review needs to surface age prominently.
   This is also why the spec has an 80-day event-date cap.
3. **Timers cannot key off listing data.** The available timepoints are process-internal
   (`:time/first-entered-state`) or booking-based (`:time/booking-start`, `:time/booking-end`, and
   the display variants). There is no listing-data timepoint, so `publicData.eventDate` cannot drive
   a transition. "12 hours after the event" needs either the event modelled as a **booking** — which
   makes it native via `{:fn/plus [{:fn/timepoint [:time/booking-end]} {:fn/period ["PT12H"]}]}`, and
   `:fn/min` lets it race another deadline — or an external scheduler using operator transitions.
   The booking route is more robust but is a real re-architecture: `default-purchase` uses stock,
   not bookings.
4. **Only one automatic transition executes per state**, even if several are scheduled. Whichever
   timepoint lands first wins.
5. **`auto-complete` fires immediately** on entering `received`, so `received` is never really seen —
   transactions land in `completed` within seconds. Verified on a real transaction: `mark-received`
   19:04:47, `auto-complete` 19:04:50.

## 5. Evidence that payouts are currently automatic

A real transaction on `ticketx1-dev`, 5 Aug 2026 (`6a735234-c58f-4597-b625-e3a2f0a542bb`):

```
request-payment   customer
confirm-payment   customer   19:09:45    £40.00 captured
mark-delivered    provider   19:02:51
mark-received     customer   19:04:47    ← payout created here, no operator involved
auto-complete     system     19:04:50
state: completed              payoutTotal: £36.00 GBP
```

Worth stating plainly because it is easy to get wrong: Stripe's **"Manual" payout schedule** setting,
which Sharetribe's setup guide tells you to select, does *not* mean the operator pays sellers by
hand. It means Stripe runs no payout timer of its own and the platform decides. Sharetribe's docs are
explicit: *"the operator should not pay out funds manually through the Stripe Dashboard if the
marketplace transaction process is using the Stripe payout action."* Doing both double-pays.

## 6. App-side work required before this can be pushed

Pushing this without the following will break the transaction pages, because the app will meet a
state it cannot render.

- `src/transactions/transactionProcessPurchase.js` — add `PAYOUT_PENDING` to `states`, the four new
  transitions, and the graph edges.
- `src/containers/TransactionPage/TransactionPage.stateDataPurchase.js` — a branch for
  `payout-pending` for both roles.
- `src/util/sellerStats.js` — `payout-pending` needs its own entry in `STATE_TO_PROGRESS`. It is not
  the same as `received`: "confirmed, awaiting release" and "paid" are now genuinely different
  things, and the sales slider currently promises "money within 2–3 days" on green.
- `src/translations/en.json` — `TransactionPage.default-purchase.{customer,provider}.payout-pending.title`,
  `TransactionPage.ActivityFeed.default-purchase.payout-pending`,
  `InboxPage.default-purchase.payout-pending.status`, and a `SalesPage.status.*` entry.
- **An admin payouts queue.** Without it, §4.1 means nothing tells the operator a payout is waiting.

### Already shipped separately

`dispute-from-purchased` is **live**. It was pushed on its own as version 2 on 2026-08-06, because
a buyer who could not dispute until the seller marked delivery was a real gap and the change is
purely additive — no transition removed, no action altered, money flow byte-identical to version 1.
It already exists in `default-purchase/`, so do not re-add it here when merging this proposal.

Everything else below is still unbuilt.

## 7. Deploying, when the time comes

```bash
flex-cli process push --path ext/transaction-processes/default-purchase-proposed \
  --process default-purchase -m ticketx1-dev
flex-cli process update-alias --alias release-1 --version 2 \
  --process default-purchase -m ticketx1-dev
```

Existing transactions stay on the version they started on; only new ones pick up v2. Rollback is
`update-alias` back to `--version 1`. Confirm whether a production marketplace exists separately from
`ticketx1-dev` — this was never established.
