# declined-withdrawals-dont-consume-limit

## Evidence Trail

README behavior test: "Withdraw €250, then attempt €300 — declined; can
still withdraw €50" and "Attempt €400 from the start — declined; full €300
still available." Directly states declined attempts must not touch the
running totals.

## Relevant Code

All four decline branches in `withdraw()` return immediately after calling
`logTransaction(amount, false, reason)` and before reaching the "Commit"
comment at index.html:542:

- Balance check: index.html:506-511
- Account limit check: index.html:513-518
- ATM limit check: index.html:520-525
- Exact-change check: index.html:527-540 (covers both "out of cash" via
  `totalAtmCash()` and "cannot make exact change" via `dispenseBills`
  returning `null`)

Only the commit block (index.html:542-550) mutates `atm.bills`,
`account.balance`, `account.withdrawnToday`, and `atm.withdrawnToday`.

## Failure Scenario

A future refactor that hoists any of the four `state.*` mutations above the
gate checks (e.g., to "optimistically" update the UI before validating)
would violate this silently, since `render()` is called unconditionally at
various points and would happily display a mutated state.

## Key Observations

This is a genuinely cheap Antithesis check: a before/after state diff
around every declined `withdraw()` call, across every decline branch. High
confidence, low implementation cost — good candidate for an early SUT-side
assertion (`Always`) directly inside `withdraw()`'s decline branches rather
than only a workload-side check, since the four branches are the natural
instrumentation points.

No open questions — all four decline paths traced and confirmed
mutation-free.
