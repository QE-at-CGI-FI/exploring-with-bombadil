# atm-denomination-exhausted

## Evidence Trail

Added during the evaluation pass (`evaluation/coverage-balance.md`),
directly motivated by `exact-change-completeness`'s confirmed
counterexample, which required a specific partially-exhausted inventory
shape (`{100:0, 50:2, 20:3, 10:0}`) that a workload refilling the ATM to
comfortable levels between sequences would rarely construct on its own.

## Relevant Code

`state.atm.bills` (index.html:433), mutated by `withdraw()`'s commit block
(index.html:544) and by `applyAdmin()`'s refill inputs (index.html:694-697)
— both are levers the workload can use to deliberately construct
exhaustion states, either by withdrawing a specific denomination down or by
setting the admin refill inputs directly.

## Failure Scenario

Not applicable — this is a liveness/exploration-guidance property. Its
"failure" mode is a workload that never drives any denomination to zero,
meaning the state space where `exact-change-completeness`-class bugs live
is never explored.

## Key Observations

Deliberately scoped as "at least one denomination at 0 while others remain"
rather than "all denominations at 0" (which would just be `totalAtmCash()
=== 0`, a different, already-implicitly-covered case via the "ATM out of
cash" decline branch in `atm-decline-reasons-explored`). Partial exhaustion
is the interesting, under-explored state — full exhaustion is the easy,
already-well-covered one.

No open questions.
