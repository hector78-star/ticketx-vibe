# default-watch — NOT DEPLOYED

**Status: authored, never pushed.** Nothing in the app uses it yet, and no version of it
exists on the marketplace. Pushing is a deliberate step — see below.

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

## Before pushing

1. **This is a live-marketplace change.** `flex-cli process push` creates the process on the
   marketplace. It is new, so it cannot revert `default-purchase` templates — the
   template-clobber risk in `HANDOFF.md` §5.10 applies to re-pushing an *existing* process,
   not to this one.
2. Add a listing type using this process for the EVENT listing type, or watches cannot be
   initiated against events.
3. **Verify `EventPage` does not start rendering `OrderPanel`** once event listings become
   transactable. This is task E24 and is easy to miss.
4. Push templates and process together, and check the rendered email in Console before
   letting the fan-out run at real watchers.
5. Enable the fan-out **last**, so a broken process never fires at real people.

```sh
flex-cli process push --path ext/transaction-processes/default-watch \
  --process default-watch -m <marketplace-id>
```

Note `flex-cli process --path` validates the `.edn` but **not** template-directory
completeness — a push can succeed and ship a broken template (`HANDOFF.md` §5.10).
