---
sut_path: /Users/maaretp/Documents/cgi-code/atm
commit: a0effb700d2c2df88f5e8502923e039eb60c0e7e
updated: 2026-09-29
external_references: []
---

# Property Relationships — ATM Simulator

## Dispensing Correctness Cluster

Properties: `dispensed-amount-matches-requested`, `bill-inventory-never-negative`,
`exact-change-completeness`, `within-limit-withdrawal-not-spuriously-declined`

Notes: All four examine `dispenseBills()` (index.html:465-481) from
different angles — correctness of amount (never wrong sum), non-negativity
of side effects (never oversells inventory), and completeness (never wrongly
refuses cash it has). `within-limit-withdrawal-not-spuriously-declined`
**dominates** `exact-change-completeness`: the latter is the one specific,
confirmed mechanism (greedy allocator incompleteness) by which the former's
broader guarantee currently fails. If `exact-change-completeness` were
fixed, `within-limit-withdrawal-not-spuriously-declined` would still be
worth keeping as a regression guard against a different mechanism (e.g., a
limit off-by-one) breaking the same user-facing guarantee later.

## Exploration Guidance Cluster

Properties: `atm-decline-reasons-explored`, `atm-denomination-exhausted`

Notes: Added during the evaluation pass to correct an assertion-type
imbalance (`evaluation/coverage-balance.md`) — both are pure
exploration-guidance properties with no correctness content of their own.
`atm-denomination-exhausted` **feeds** the Dispensing Correctness cluster
directly: it names the precondition (partial bill exhaustion) that made
`exact-change-completeness`'s confirmed counterexample possible in the
first place. `atm-decline-reasons-explored` is a broader net that happens
to include the same branch (its fifth reason, "cannot make exact change,"
is the entry point to the same bug). Treat these two as instrumentation for
the Dispensing Correctness cluster rather than a fully independent
category.

## Limit Enforcement Cluster

Properties: `atm-daily-limit-never-exceeded`, `account-daily-limit-never-exceeded`,
`declined-withdrawals-dont-consume-limit`, `admin-limit-reduction-blocks-overdrawn-account`

Notes: All four gate on the same two computed values, `accRemaining` and
`atmRemaining` (index.html:502-503), from different directions:
`atm-daily-limit-never-exceeded` and `account-daily-limit-never-exceeded`
check the *cumulative* invariant holds after every success;
`declined-withdrawals-dont-consume-limit` checks the counters don't move on
failure; `admin-limit-reduction-blocks-overdrawn-account` checks the
specific case where `dailyLimit` itself is lowered mid-day via the admin
panel. No dominance — each covers a distinct code path or mutation
direction, and a bug in one wouldn't necessarily manifest in another (e.g.,
an off-by-one in the commit-block mutation wouldn't be caught by the
decline-path property).

## Debug/Admin Tooling Consistency Cluster

Properties: `withdrawn-elsewhere-bounded`, `admin-limit-reduction-blocks-overdrawn-account`,
`clock-rewind-resets-counters`

Notes: These three share a theme rather than a code path — each is about
the admin/debug tooling (the "elsewhere" input, the limit-change admin
control, the clock-simulation admin control) interacting with the core
limit logic in a way ordinary withdrawal flows never exercise.
`withdrawn-elsewhere-bounded` and `admin-limit-reduction-blocks-overdrawn-account`
both traced through the same underlying asymmetry (the gating `accRemaining`
computation at index.html:502 is unclamped while the display copy at
index.html:577 is `Math.max(0, ...)`-clamped) and both concluded the
asymmetry is safe — worth noting as a shared finding in case a future
refactor touches that line and needs to remember why it's unclamped on
purpose. `clock-rewind-resets-counters` is a distinct mechanism
(`checkDayReset()`'s string-inequality comparison) but shares the same
"admin debug tool can construct impossible-looking states" flavor.

## Day-Boundary Cluster

Properties: `daily-counters-reset-at-day-boundary`, `clock-rewind-resets-counters`

Notes: Both center on `checkDayReset()` (index.html:448-457) and its
`state.resetDate !== todayStr()` comparison. `daily-counters-reset-at-day-boundary`
is the liveness side (reset eventually happens on a forward crossing);
`clock-rewind-resets-counters` is the safety-relevant side (the same
comparison also fires on a *backward* crossing, which shouldn't represent
real elapsed time). Same code, opposite directions of time movement —
worth testing together since a fix to one (e.g., tracking monotonic real
time instead of a date string) would likely change both at once.

## Input Validation Cluster

Properties: `withdrawal-amount-positive-multiple-of-ten`, `fractional-amount-truncated-not-rejected`

Notes: Both trace through the same two lines
(`parseInt(input.value, 10)` then the `%10` check, index.html:491-500).
`withdrawal-amount-positive-multiple-of-ten` holds today for every case
checked; `fractional-amount-truncated-not-rejected` is the specific case
where `parseInt`'s truncation lets an invalid raw input string slip through
as a valid parsed amount. Not a dominance relationship — the broader
property's truth doesn't depend on the narrower one being fixed, since the
narrower property is about *silent information loss*, not about producing
an amount that fails the broader property's own checks.

## User-Facing Feedback Cluster (Standalone)

Property: `decline-reason-not-surfaced`

Notes: No shared code path with any other property — it's purely about
what `showMessage()` displays, downstream of every decline branch in the
Limit Enforcement and Dispensing Correctness clusters. Connected to those
clusters conceptually (it fires whenever any of them's decline paths does)
but doesn't share failure mechanism, so not grouped with them.

## State Lifecycle and Resource Boundaries (Standalone, Low Priority)

Properties: `no-state-persistence-across-reload`, `transaction-history-bounded-growth`

Notes: Unrelated to each other and to every other cluster — included for
portfolio completeness per `sut-analysis.md`'s Focus 2 and Focus 12 notes,
not because either is believed to be a meaningful risk. Grouped together
here only because both are single-property "no cluster" entries with the
same low-priority flavor.
