# atm-decline-reasons-explored

## Evidence Trail

Added during the evaluation pass (`evaluation/coverage-balance.md`), not
initial discovery — the catalog's assertion-type portfolio was found to be
almost entirely `Always` with no exploration-guidance assertions telling
Antithesis which states are interesting to reach.

## Relevant Code

Five decline branches in `withdraw()`, each with a distinct `detail`
string passed to `logTransaction()`:

- `'Insufficient account balance'` — index.html:507
- `'Account daily limit reached'` — index.html:514
- `'ATM daily limit reached'` — index.html:521
- `'ATM out of cash'` — index.html:528
- `'Cannot make exact change'` — index.html:536

## Failure Scenario

Not applicable — this is a reachability/exploration-guidance property, not
a correctness check. Its "failure" mode is Antithesis's search never
constructing the preconditions for one or more of the five branches (most
likely the last one, "cannot make exact change," which requires a
specifically lopsided bill inventory — see `atm-denomination-exhausted`).

## Key Observations

The five `detail` strings are already unique and specific (satisfying
`property-catalog.md`'s "every planned assertion message must be unique"
guidance) — no code changes needed, this property only requires the
workload to assert on the existing DOM-visible transaction history
(`#history`, populated by `renderHistory()`) or on `logTransaction`'s call
sites if SUT-side instrumentation is preferred for reliability.

No open questions.
