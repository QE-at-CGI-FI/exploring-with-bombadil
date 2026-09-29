# admin-limit-reduction-blocks-overdrawn-account

## Evidence Trail

Emerges from tracing `applyAdmin()` (index.html:693-703) against
`withdraw()`'s gate logic — the admin panel lets `dailyLimit` change at any
time, including mid-day after withdrawals have already happened, which
README's own oracle questions gesture at ("Bank changes the limit from
€300 to €500 mid-day — does the new limit apply immediately?").

## Relevant Code

- `applyAdmin()` sets `state.account.dailyLimit` directly from the admin
  input with no relationship enforced to `withdrawnToday`
  (index.html:699).
- Gate in `withdraw()`: `const accRemaining = state.account.dailyLimit -
  state.account.withdrawnToday - state.account.withdrawnElsewhere;`
  (index.html:502) — **not** clamped to a minimum of 0 here.
- Display in `render()`: `const accRemaining = Math.max(0, acc.dailyLimit -
  acc.withdrawnToday - acc.withdrawnElsewhere);` (index.html:577) — **is**
  clamped, purely for the UI (`setValText`'s percentage-based coloring
  would otherwise misbehave on a negative value).

## Failure Scenario

Withdraw €400 against a €500 account limit (`withdrawnToday = 400`), then
an admin lowers `dailyLimit` to €300 via `applyAdmin()`. `accRemaining =
300 - 400 - 0 = -100`. Any subsequent withdrawal attempt (`amount > 0`)
satisfies `amount > accRemaining` (any positive number exceeds -100) and is
correctly declined. Traced this holds for the smallest possible amount
(€10, the minimum step) as well as large ones — no boundary where a
particular `amount` could slip through the negative-`accRemaining` gate.

## Key Observations

This is the same asymmetry noted in `withdrawn-elsewhere-bounded.md`'s
investigation log — `accRemaining`'s gating computation
(index.html:502) and its display computation (index.html:577) diverge in
whether they clamp to 0, but only the display one needs to for UI
correctness; the gating one is safe unclamped precisely because `amount` is
always positive. Documenting this explicitly here since it's the kind of
"looks like it could be a bug" pattern (two copies of similar-looking
arithmetic, one clamped and one not) that's worth a property specifically
confirming the asymmetry is benign rather than leaving it as an implicit
assumption.

No open questions — the arithmetic is fully traced and the asymmetry
confirmed safe.
