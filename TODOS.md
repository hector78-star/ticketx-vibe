# TODOS

Deferred work with its reasoning. Added 2026-08-07 from `/plan-ceo-review`.
Full context: `~/.gstack/projects/hector78-star-ticketx-vibe/ceo-plans/2026-08-07-event-watch-and-drop-alerts.md`

---

## 1. Fair allocation — the claim draw (P1, Semester 2)

**What.** A ticket listing opens a short claim window (60-90s) instead of first-tap-wins.
Everyone watching the event is alerted, taps to claim, and one is drawn at random.

**Why.** This is the 10-star product. At St Andrews a ball ticket already goes to whoever
DMs fastest or whoever the seller already knows — [the student press was writing about
this in 2017](https://thestand-online.com/2017/10/10/invitation-overpriced-problem-balls/)
and nothing has changed. A fair draw breaks that cartel. It is the one thing no Facebook
group and no competitor can copy, and it is what makes a fresher or an international
student feel chosen rather than shut out. "The app that makes ball tickets fair" writes
its own coverage in The Saint.

**Pros.** Uncopyable positioning. Earns press. Directly serves the people currently
excluded from the market.

**Cons.** Sellers may resist — many *want* to pick their buyer or want the maximum price.
If sellers defect back to Facebook there is no market at all. Fights Sharetribe's
transaction model hard: claim windows and random draws are not native operations.

**Context.** Deferred in the 2026-08-07 CEO review purely on sequencing, not merit. The
event-watch work shipping now is its substrate — a claim draw needs to know who is
watching an event and needs to be able to reach them, which is exactly what the watch
transaction provides. Nothing built for drop alerts is wasted here.

**Effort.** L (human ~3-4 weeks) → M with CC+gstack (~8-12 hrs).

**Depends on / blocked by.**
- The 14-day auto-cancel fix (see `HANDOFF.md` §2). A fair draw that then refunds the
  buyer at day 14 is worse than no draw at all. **Hard blocker.**
- Event watch + drop alerts (in progress).

---

## 2. Attended-only post-event rooms (P3)

**What.** A space for each event, gated to verified attendees only — the app knows who
actually went, because it processed the tickets.

**Why.** The only exclusivity gate in this product that is genuine and uncopyable. Nobody
else can verify who was at Starfields. It turns transaction history into a social asset.

**Pros.** Real gate, not manufactured scarcity. Uses data only you hold.

**Cons.** Dead-forum risk dominates. 800 attendees and four posts is a public, permanent,
dated record that nobody is here — worse than not existing. Moderation on a named-identity
student forum is a real burden landing on one undergraduate.

**Context.** Rejected for now in the CEO review because it requires volume that does not
exist. Revisit only once event volume makes a gated room non-empty on day one. If it is
ever built, seed it — never launch an empty one.

**Effort.** L (human ~3 weeks) → M with CC+gstack (~6-8 hrs).

**Depends on / blocked by.** Meaningful transaction volume across several events.

---

## 3. Revisit the price ceiling on watches (P3)

**What.** Let a watcher set "only alert me under £70" rather than alerting on every ticket.

**Why.** If a watcher on a popular event gets alerted about £150 tickets they would never
buy, they learn the alerts are junk and mute them — which kills the one mechanic bringing
people back.

**Pros.** Alert relevance. Also captures real willingness-to-pay per event, which is the
most defensible dataset this product could accumulate.

**Cons.** One more field in the watch flow. A ceiling set too low means silence the user
may read as the feature being broken.

**Context.** **Cut, not deferred**, in the 2026-08-07 CEO review. The mitigation shipped
instead: the alert email shows asking price next to face value (data already present), so
recipients self-filter at a glance. Revisit only if real alert volume proves that is
insufficient — check after the first ball weekend.

**Effort.** S (human ~half a day) → S with CC+gstack (~30 min).

**Depends on / blocked by.** Real alert-volume data from a live ball weekend.
