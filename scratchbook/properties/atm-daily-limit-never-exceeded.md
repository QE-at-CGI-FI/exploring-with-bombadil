# atm-daily-limit-never-exceeded

## Evidence Trail

README.md states the requirement directly: "An ATM allows a daily withdraw
limit of 300€" — the ATM-side half of the effective limit rule
(`ATM remaining = ATM daily limit − sum of approved withdrawals at this ATM
today`).

## Relevant Code

- `state.atm.dailyLimit`, `state.atm.withdrawnToday` — index.html:430-434
- Gate: `const atmRemaining = state.atm.dailyLimit - state.atm.withdrawnToday;`
  index.html:503; decline branch index.html:520-525
- Mutation on success only: `state.atm.withdrawnToday += amount;`
  index.html:548, inside the "Commit" block (index.html:542-548) which only
  runs after all four gates (balance, account limit, ATM limit, exact
  change) pass.
- Reset: `checkDayReset()`, index.html:448-457, zeroes `atm.withdrawnToday`
  when the calendar day changes.

## Failure Scenario

If a future change reordered the commit block ahead of the gate checks, or
if `checkDayReset()` failed to fire before a gate check (e.g., a call path
that skips `checkDayReset()` — currently only `applyAdmin()` skips it, and
it doesn't touch `withdrawnToday`), `withdrawnToday` could exceed
`dailyLimit`. Today's code has no such path, but this is exactly the kind of
one-line reordering an interleaving search is good at finding.

## Key Observations

This property is orthogonal to `admin-limit-reduction-blocks-overdrawn-account`
— that property covers the case where `dailyLimit` itself moves; this one
covers `withdrawnToday` moving. Both must hold simultaneously (`accRemaining`
and `atmRemaining` are computed independently, index.html:502-503, and gated
via `Math.min` conceptually — each checked separately in sequence).

No open questions — the mechanism is fully traced and the invariant holds
in the current code.
