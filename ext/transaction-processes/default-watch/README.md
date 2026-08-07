# default-watch — CREATED, NOT YET WIRED

**Status: version 1 exists on `ticketx1-dev`.** Created 2026-08-07 and verified by pulling
it back: the `.edn` is semantically identical to this directory and both templates round-trip
byte-identical (after normalising CRLF). The rendered email was previewed end to end and every
protected-data key resolves.

**Nothing uses it yet.** No listing type points at this process, so no watch can be initiated
and no user is affected. See "Still to do" below.

## What it is

A free, no-payment transaction process whose only job is to make an event watch
addressable by Sharetribe's email system.

A notification's `:to` must be `:actor.role/customer` or `:actor.role/provider` — the two
parties *of that transaction*. There is no way to email a third party
([process format reference](https://www.sharetribe.com/docs/references/transaction-process-format/#notifications)).
So for Sharetribe to email someone merely watching an event, the watch has to *be* a
transaction and the watcher has to be its customer.

That constraint is the entire reason this process exists. It also removes the need for an
external email vendor: Sharetribe handles SPF and DKIM for its own sends.

Side benefit worth keeping in mind: "who is watching event X" becomes
`transactions.query({listingId})`, a first-class indexed query, rather than paging the
whole userbase and filtering `publicData` in memory.

## Shape

```
:transition/watch (customer)
      │
      ▼
:state/watching ──────┐
      │   ▲           │ :transition/ticket-dropped (operator, self-loop)
      │   └───────────┘ fires :notification/ticket-dropped to the customer
      │
      ├── :transition/unwatch (customer)
      └── :transition/operator-unwatch (operator)
                │
                ▼
          :state/unwatched
```

`ticket-dropped` is operator-only because the Integration API can invoke operator
transitions **and nothing else**
([reference](https://www.sharetribe.com/api-reference/integration.html#transition-transaction)).
`operator-unwatch` exists for the same reason: `server/api/delete-account.js` runs as
operator and cannot invoke a customer's own `unwatch`, but still has to retire the watches
of a departing user.

## The 100-transition ceiling

**Sharetribe caps a transaction at 100 transitions.** Because `ticket-dropped` loops back
into `:state/watching`, a watch on a busy event burns one transition per alert and dies
silently at the ceiling — no error, the watcher simply stops hearing anything.

The fan-out must read `transaction.attributes.transitions.length` and, past roughly 90,
stop transitioning that watch and re-create it instead. This was not in the CEO or eng
review; it surfaced while authoring the process.

For a single ball, 99 drops is unlikely. For a heavily traded event across a whole
semester, it is not.

## Protected data on ticket-dropped

The listing on a watch transaction is the **event**, not the ticket that dropped. The
ticket's asking price, face value and URL are not reachable from the transaction, so
`ticket-dropped` carries them in via `:action/update-protected-data` and the email template
reads them back out.

The fan-out must pass:

| Key | Example | Used for |
|---|---|---|
| `askingPrice` | `£65` | The large price in the email |
| `faceValue` | `£45` | The comparison beneath it |
| `eventWhen` | `SAT 27 SEP, KINKELL BYRE` | The meta line |
| `ticketUrl` | absolute URL to the ticket's checkout | The one button |
| `unwatchUrl` | absolute URL that turns alerts off | The footer opt-out |

Format prices as strings with the real `£` glyph before passing them. The approved mockup
renders "GBP 65" only because the image model avoids the pound sign; that is a generation
artifact, not a design decision.

## Email template

`templates/watch-ticket-dropped/` — built from `designs/alert-email-20260807/variant-A.png`
with variant B's footer wording.

No webfonts: email clients will not load Instrument Serif reliably, so the one display line
falls back to Georgia and everything else to Helvetica/Arial. Left-aligned single column,
hairline rules only, exactly one button.

## Still to do before a single alert can fire

1. **Point a listing type at this process.** The EVENT listing type in
   `src/config/configListing.js` needs a `transactionType` using `default-watch`, or
   `transactions.initiate` has nothing to initiate against. Until then the ALERT ME control
   cannot be wired.
2. **Verify `EventPage` does not start rendering `OrderPanel`** once event listings become
   transactable. Task E24, and easy to miss.
3. **Integration API credentials.** The fan-out queries watchers and runs operator
   transitions, and only the Integration API can do either.
4. **Build the notify endpoint and sweeper**, honouring the transition ceiling above.
5. **Enable the fan-out last**, so a half-built one never fires at real people.

## Commands

`create` is for a process that does not exist; `push` only **updates** an existing one. This
process was created with:

```sh
flex-cli process create --path ext/transaction-processes/default-watch \
  --process default-watch -m ticketx1-dev
```

Subsequent changes use `push`, which adds a new version:

```sh
flex-cli process push --path ext/transaction-processes/default-watch \
  --process default-watch -m ticketx1-dev
```

Two things to know. `flex-cli process --path` validates the `.edn` but **not**
template-directory completeness, so a push can succeed and ship a broken template
(`HANDOFF.md` §5.10). And when diffing a pulled copy against this directory, templates are
stored with CRLF while the repo uses LF — compare with
`diff <(tr -d '\r' < a) <(tr -d '\r' < b)` before believing a difference is real.

**A Sharetribe process cannot be deleted.** Versions accumulate; nothing is ever removed.
