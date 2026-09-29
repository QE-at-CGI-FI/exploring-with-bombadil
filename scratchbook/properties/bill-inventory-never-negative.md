# bill-inventory-never-negative

## Evidence Trail

Physical constraint: an ATM cannot dispense a bill it doesn't have. No
explicit README test names this directly, but it underlies every
denomination-interaction test in README (bills counts drive whether
"exact change" is possible at all).

## Relevant Code

- `dispenseBills()` bounds `use` by `draft[d]` (a shallow copy of
  `bills`), index.html:472: `const use = Math.min(Math.floor(remaining / d),
  draft[d]);` — cannot select more than available.
- Applied to real state only in the commit block: `state.atm.bills[d] -=
  dispensed[d];` index.html:544, only for `d` where `dispensed[d]` is
  truthy (i.e., `> 0`).
- `applyAdmin()` also writes `atm.bills[d]` directly from admin input,
  clamped to `Math.max(0, ...)` (index.html:694-697) — the other place
  bill counts change, and it's non-negative by construction there too.

## Failure Scenario

No known path to a negative count today. Property retained as a regression
guard on `dispenseBills`'s availability bound and as the natural
counterpart to `dispensed-amount-matches-requested` and
`exact-change-completeness` — all three properties examine the same
function from different angles (correctness, completeness, and
non-negativity of its side effects).

No open questions.
