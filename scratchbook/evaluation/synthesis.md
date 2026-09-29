---
sut_path: /Users/maaretp/Documents/cgi-code/atm
commit: a0effb700d2c2df88f5e8502923e039eb60c0e7e
updated: 2026-09-29
external_references: []
---

# Evaluation Synthesis

Ran all 4 lenses in single-agent mode (see `antithesis-fit.md`,
`coverage-balance.md`, `implementability.md`, `wildcard.md`). Categorized
findings below.

## Gap

**Assertion-type imbalance — catalog is `Always`-heavy with almost no
exploration-guidance properties.** (Coverage Balance)

Action taken: added 2 properties directly to `property-catalog.md`
(`atm-decline-reasons-explored`, `atm-denomination-exhausted`), with
evidence files, and updated `property-relationships.md` to place them in
the Dispensing Correctness cluster. This is a small expansion (2
properties, no new category) — per `references/property-evaluation.md`,
no second full evaluation pass is warranted.

## Refinement

**`daily-counters-reset-at-day-boundary` / `clock-rewind-resets-counters`
depend on an unpinned host timezone.** (Implementability)

Action taken: added a `TZ=UTC` recommendation to the SUT container
description in `deployment-topology.md`, and noted the DST-variation
option as a distinct, deliberately-scoped future property rather than an
accidental side effect of an unpinned default.

**`transaction-history-bounded-growth` is impractical within normal
Antithesis timeline limits.** (Implementability)

Action taken: added a priority/scope note directly to the property's
catalog entry and evidence file marking it explicitly low-priority /
possibly-out-of-scope-for-Antithesis, rather than silently implementing it
and getting a meaningless pass every run.

**Five properties are deterministic, single-scenario checks, not
fault-injection targets.** (Antithesis Fit)

Action taken: no catalog removal (all five are real, README-grounded
guarantees worth keeping as documentation and as one-time sanity checks) —
added a one-line note to each affected catalog entry's Antithesis Angle
field (already present in 4 of 5 from discovery; confirmed accurate by this
evaluation pass rather than rewritten) flagging them as weak-fit-but-cheap
rather than core fault-injection targets. No structural catalog change
needed beyond what discovery had already written.

## Bias

**Is a full Antithesis deployment proportionate for a 720-line teaching
artifact?** (Wildcard)

Not resolved by editing the catalog — presented to the user directly (see
chat response accompanying this research pass) with the supporting
evidence from `wildcard.md`. The catalog and topology are built assuming
the answer is "yes, worth it," which the human should confirm or redirect.

**Three catalog properties describe currently-failing invariants, mixed in
without a status marker distinguishing them from properties that currently
hold.** (Wildcard)

Partially addressed: `property-catalog.md`'s opening paragraph already
names both confirmed defects explicitly (from discovery). Left as a
lighter-touch note rather than adding a formal `status` field to every
entry — that's a workload/reporting-format decision for whoever implements
the run, out of scope for this research pass to prescribe.

## Summary of Catalog Changes From This Evaluation Pass

- Added: `atm-decline-reasons-explored`, `atm-denomination-exhausted`
  (2 new properties, both Reachability/Liveness, filling the assertion-type
  gap).
- Updated: `deployment-topology.md` (added `TZ=UTC` pinning
  recommendation).
- Updated: `property-catalog.md` entry for `transaction-history-bounded-growth`
  (priority/scope note).
- Updated: `property-relationships.md` (new properties placed in the
  Dispensing Correctness cluster).
- No properties invalidated.
- Final catalog size: 19 properties.
