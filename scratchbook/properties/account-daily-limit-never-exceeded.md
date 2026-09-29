# account-daily-limit-never-exceeded

## Evidence Trail

README's "Effective limit rule": `Account remaining = Account daily limit −
sum of approved withdrawals across all ATMs today`. Since the SUT only
implements one live ATM, "across all ATMs" is represented by the
manually-entered `state.account.withdrawnElsewhere`.

## Relevant Code

- Gate: `const accRemaining = state.account.dailyLimit -
  state.account.withdrawnToday - state.account.withdrawnElsewhere;`
  index.html:502; decline branch index.html:513-518.
- `withdrawnElsewhere` is set via `setElsewhere()` (index.html:459-463,
  bound-clamped this session) or reset to 0 by `checkDayReset()`
  (index.html:452, plus the DOM sync at index.html:454-455).
- `withdrawnToday` (account side) mutated only in the commit block,
  index.html:547.

## Failure Scenario

A tester raises `withdrawnElsewhere` via the debug input to just under the
limit, then a real withdrawal at this ATM for an amount that individually
fits `atmRemaining` and `balance` but, combined with the already-set
`withdrawnElsewhere`, should be declined. Confirmed by trace that
`accRemaining` correctly accounts for both terms before the gate check —
this property exists to keep that arithmetic correct as the code evolves,
and to catch any ordering bug where `withdrawnElsewhere` could be read
stale (e.g., cached before a `setElsewhere()` call resolves — not possible
today since everything is synchronous, but worth guarding).

## Key Observations

`withdrawnElsewhere` is a **user-entered simulation of a second ATM's
activity, not a live value** — see `sut-analysis.md` Focus 12. Any property
framed around a truly concurrent second ATM (as README's oracle questions
ask about — "Concurrent withdrawal at two ATMs at the same instant") is out
of scope: the SUT has no mechanism to model that race, only to manually
set its outcome after the fact.

## Open Questions

- Is `withdrawnElsewhere` meant to be user-settable at all mid-transaction,
  or should it be locked once a withdrawal is in flight? Not applicable
  today (no async gap exists between reading and using it in `withdraw()`),
  but worth a note if the SUT ever gains any async step. Not yet
  investigated beyond confirming there's currently no async gap to exploit.
