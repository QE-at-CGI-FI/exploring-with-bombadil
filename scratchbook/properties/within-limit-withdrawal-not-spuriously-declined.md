# within-limit-withdrawal-not-spuriously-declined

## Evidence Trail

Implicit in README's entire premise: the exercise is about a €300/day
*limit*, which presumes that anything under the limit (and within balance
and cash) should otherwise succeed. Every README behavior test that says
"succeeds" is an instance of this broader completeness guarantee.

## Relevant Code

The four independent gates in `withdraw()`:

1. `amount > state.account.balance` (index.html:506)
2. `amount > accRemaining` (index.html:513, where `accRemaining =
   dailyLimit - withdrawnToday - withdrawnElsewhere`)
3. `amount > atmRemaining` (index.html:520, where `atmRemaining =
   dailyLimit - withdrawnToday`)
4. `amount > totalAtmCash()` or `dispenseBills(amount, bills) === null`
   (index.html:527, 535)

## Failure Scenario

This property is the general form of `exact-change-completeness`: gate 4's
second half (`dispenseBills` returning `null`) is a **confirmed, traced**
mechanism by which this broader guarantee fails today (see
`exact-change-completeness.md` for the full reproduction). Gates 1-3 are
simple numeric comparisons with no known incompleteness.

## Key Observations

Kept as a separate property from `exact-change-completeness` deliberately:
that property names one specific mechanism (the greedy allocator); this one
names the user-facing guarantee it violates. A future code change could
introduce a *different* mechanism that breaks this same guarantee (e.g., an
off-by-one turning gate 2 or 3 into `amount >= accRemaining` instead of
`>`) without ever touching `dispenseBills()`. Tracking both keeps the
catalog resilient to that kind of future divergence — see
`property-relationships.md` for the dominance note between the two.

No open questions beyond the one already recorded under
`exact-change-completeness.md`.
