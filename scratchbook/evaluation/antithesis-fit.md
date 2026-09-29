---
sut_path: /Users/maaretp/Documents/cgi-code/atm
commit: a0effb700d2c2df88f5e8502923e039eb60c0e7e
updated: 2026-09-29
external_references: []
---

# Evaluation: Antithesis Fit

## Findings

### catalog-wide — five properties are deterministic single-scenario checks, not fault-injection targets

- **Property/Properties:** `withdrawal-amount-positive-multiple-of-ten`,
  `fractional-amount-truncated-not-rejected`, `no-state-persistence-across-reload`,
  `decline-reason-not-surfaced`, `transaction-history-bounded-growth`
- **Concern:** Each is fully reproducible from one fixed input/scenario with
  no timing, ordering, or partial-failure dimension — a unit test proves or
  disproves each in one shot. Running these under Antithesis's interleaving
  search spends search budget without exploring any state space these
  properties are sensitive to.
- **Scope:** Catalog-wide pattern, five affected properties.
- **Evidence:** `fractional-amount-truncated-not-rejected` is settled purely
  by `parseInt("300.5", 10) === 300` — no sequence of operations changes
  that outcome. `no-state-persistence-across-reload` is settled by the
  absence of any persistence API in the file — true or false on every run
  identically, independent of any interleaving.
- **Suggested action:** Keep all five in the catalog (they're real,
  README-grounded guarantees worth documenting and worth a one-time
  workload check), but mark them explicitly as unit-test-equivalent rather
  than implying Antithesis's search is doing meaningful work finding them.
  Antithesis can still *run* them once per timeline as a cheap sanity check
  alongside the real fault-injection properties, but they shouldn't be
  weighted as if they justify the deployment.

### exact-change-completeness / within-limit-withdrawal-not-spuriously-declined — correctly identified as strong fits, underrated relative to their value

- **Property/Properties:** `exact-change-completeness`,
  `within-limit-withdrawal-not-spuriously-declined`
- **Concern:** None — flagging as a **pass with a note**, not a problem.
  These are exactly the property-evaluation guidance's "underestimated
  value" case: the catalog entry for `exact-change-completeness` already
  found a real bug through *code tracing alone*, by hand, with a single
  constructed counterexample. That's a strong signal this property class
  has many more undiscovered counterexamples reachable only through
  Antithesis's combinatorial search over `(bill inventory state, requested
  amount)` pairs — a much larger space than one person can hand-trace.
- **Scope:** Property-specific, but worth calling out catalog-wide as the
  strongest justification for running Antithesis on this SUT at all.
- **Evidence:** See `properties/exact-change-completeness.md`'s full trace.
- **Suggested action:** Prioritize these two above the limit-enforcement
  cluster when sequencing implementation — they're where fault injection
  demonstrably outperforms manual review on this exact codebase.

### daily-counters-reset-at-day-boundary / clock-rewind-resets-counters — strong timing fit

- **Property/Properties:** `daily-counters-reset-at-day-boundary`,
  `clock-rewind-resets-counters`
- **Concern:** None — pass. Both are explicitly about "what happens at
  exactly the wrong moment" (a boundary crossing, forward or backward) —
  Antithesis's stated sweet spot.
- **Scope:** Property-specific.
- **Evidence:** `checkDayReset()`'s string-inequality comparison
  (index.html:449) has no notion of directionality — exhaustively
  searching crossing timings (exact boundary instant, one second before/
  after, repeated rewind/restore sequences) is squarely combinatorial
  timing exploration.
- **Suggested action:** None needed.

### limit-enforcement and admin-consistency clusters — moderate fit, real but modest value

- **Property/Properties:** `atm-daily-limit-never-exceeded`,
  `account-daily-limit-never-exceeded`, `declined-withdrawals-dont-consume-limit`,
  `admin-limit-reduction-blocks-overdrawn-account`, `withdrawn-elsewhere-bounded`
- **Concern:** These have a genuine ordering/interleaving dimension
  (withdrawal sequences interleaved with admin actions) but the state space
  is small — a handful of manually-written sequential test cases would
  likely already cover it, since there's no concurrency to produce
  interleavings a human wouldn't think to write by hand (see
  `sut-analysis.md` Focus 3: single-threaded, synchronous). Antithesis adds
  value here mainly as a regression net against future refactors, not as a
  bug-finding tool on the current code (traced by hand, all five hold
  today).
- **Scope:** Cluster-wide (5 properties).
- **Evidence:** `sut-analysis.md` Focus 3 confirms no true concurrency
  exists in the SUT to produce interleavings a sequential hand-written test
  suite couldn't already enumerate.
- **Suggested action:** Keep in the catalog — real properties, real
  regression value — but don't expect Antithesis to surface anything here
  a careful manual test suite wouldn't already catch. Lower relative
  priority than the dispensing-completeness and clock-boundary clusters.

## Passes

- `exact-change-completeness`, `within-limit-withdrawal-not-spuriously-declined`,
  `daily-counters-reset-at-day-boundary`, `clock-rewind-resets-counters` — strong
  fits, no concerns.
- Assertion type choices throughout match `property-catalog.md`'s "Choosing
  the Right Antithesis Assertion" guidance (e.g., `Sometimes` used only for
  the one genuine liveness property, not as a substitute for `Reachable`).

## Uncertainties

- Whether the deterministic five (see first finding) are worth *any*
  Antithesis run time versus being pure unit tests run outside Antithesis
  entirely is a workload-design call, not something this lens can settle
  — depends on whether the team wants one unified test entrypoint or two
  separate ones (unit tests + Antithesis timelines).
