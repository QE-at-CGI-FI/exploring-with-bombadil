---
sut_path: /Users/maaretp/Documents/cgi-code/atm
commit: a0effb700d2c2df88f5e8502923e039eb60c0e7e
updated: 2026-09-29
external_references: []
---

# Evaluation: Implementability

## Findings

### daily-counters-reset-at-day-boundary / clock-rewind-resets-counters — pass/fail outcome depends on unpinned host timezone

- **Property/Properties:** `daily-counters-reset-at-day-boundary`,
  `clock-rewind-resets-counters`
- **Concern:** Both properties' evidence files already flag this as an
  open question, but from an implementability angle it's sharper than "a
  question": without pinning a timezone, the same workload run can produce
  different pass/fail outcomes on different Antithesis infrastructure (or
  the same infrastructure at a different time of year, across a DST
  transition), making results non-reproducible.
- **Scope:** Property-specific, but affects deployment topology.
- **Evidence:** `todayStr()` → `Date#toDateString()` (index.html:445) has
  no explicit timezone; `deployment-topology.md` (as written before this
  evaluation) didn't specify a `TZ` environment variable for the SUT
  container.
- **Suggested action:** **Refinement.** Pin `TZ=UTC` (or another fixed
  zone) in the SUT container's environment in `deployment-topology.md`, so
  the day-boundary properties get deterministic, reproducible results. If
  DST-transition behavior specifically is desired as a property (per
  README's oracle question about 23/25-hour days), that becomes a
  separate, deliberately-varied-timezone property rather than an accidental
  side effect of an unpinned default. Applied below.

### all core properties are DOM-observable — no hidden-state instrumentation needed

- **Property/Properties:** catalog-wide
- **Concern:** None — pass. Checked whether any property requires reading
  `state` fields that aren't rendered anywhere in the DOM.
- **Scope:** N/A (pass).
- **Evidence:** Every field the catalog references is rendered as visible
  text by `render()` (index.html:573-608): balance (`#dispBalance`), both
  daily limits, both withdrawn-today counters, `withdrawnElsewhere` (as the
  literal input value, `#inputElsewhere`), all four bill counts
  (`#count100`..`#count10`), and the full transaction history including
  per-transaction `detail` reason strings (`#history`, via `renderHistory()`).
  No property in the catalog needs SUT source changes or new instrumentation
  to be observed by a workload — everything is already exposed as DOM text.
- **Suggested action:** None needed. Worth noting explicitly in
  `sut-analysis.md`-adjacent context: this SUT needs zero SUT-side code
  changes to support the catalog, unusual for how thorough the coverage is
  — a consequence of the DEBUG panel already existing specifically to make
  internal state inspectable for testing purposes.

### exact-change-completeness / within-limit-withdrawal-not-spuriously-declined — require a workload-side reference oracle, feasible but non-trivial

- **Property/Properties:** `exact-change-completeness`,
  `within-limit-withdrawal-not-spuriously-declined`
- **Concern:** Both need the workload to independently compute "does a
  feasible bill combination exist" via exhaustive/DP search over the 4
  fixed denominations and their current counts (read from the DOM bill
  counts), then compare against the SUT's actual outcome. This is a small,
  tractable search (4 denominations, bounded counts) — not a concern about
  feasibility, but worth flagging as workload complexity that's easy to
  get subtly wrong (e.g., the oracle itself needs its own correctness
  double-check, or it risks "confirming" a bug that's actually in the
  oracle).
- **Scope:** Property-specific (both share the same oracle).
- **Evidence:** `properties/exact-change-completeness.md`'s trace;
  `deployment-topology.md`'s workload-client description already calls
  out this oracle requirement.
- **Suggested action:** No catalog change needed — already correctly
  scoped in the topology doc. Recorded here as an implementation risk to
  carry forward to whoever builds the workload (build the oracle once,
  unit-test the oracle itself against the hand-traced counterexample in
  `exact-change-completeness.md` before trusting it against the SUT).

### transaction-history-bounded-growth — impractical within normal Antithesis timeline limits

- **Property/Properties:** `transaction-history-bounded-growth`
- **Concern:** Confirming "does not grow unbounded" meaningfully requires
  sustaining a very large number of transactions within one timeline —
  `references/property-evaluation.md`'s Implementability guidance calls
  this out directly: "A property that requires sustaining high throughput
  for minutes may not work within Antithesis timeline limits." A few dozen
  or even few hundred transactions (a realistic timeline budget) won't
  meaningfully exercise unbounded growth.
- **Scope:** Property-specific.
- **Evidence:** `state.transactions.unshift()`, index.html:564, no cap;
  realistic Antithesis timeline lengths vs. what's needed to observe
  meaningful growth.
- **Suggested action:** **Refinement** — demote priority explicitly (this
  property already reads as the catalog's weakest by its own evidence
  file's admission) or drop it from the actively-implemented set and keep
  it recorded as a documented, consciously-deprioritized item rather than
  quietly implementing it and getting a meaningless pass every time.

## Passes

- All properties are DOM-observable with zero required SUT-side code
  changes — unusually clean implementability baseline.
- `deployment-topology.md`'s single-SUT-container, single-client topology
  supports every property in the catalog except the explicitly-flagged
  timezone gap above.

## Uncertainties

- Whether the intended Antithesis SDK/workload environment can drive a
  real browser DOM directly, or needs a headless-browser wrapper, is
  already flagged as an open question in `deployment-topology.md` and not
  resolvable from the SUT's source — carried forward, not re-litigated
  here.
