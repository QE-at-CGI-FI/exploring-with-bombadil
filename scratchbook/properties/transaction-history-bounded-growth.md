# transaction-history-bounded-growth

## Evidence Trail

Arose from `sut-analysis.md` Focus 2 (State Management) — the one
genuinely unbounded data structure found in the codebase.

## Relevant Code

```js
function logTransaction(amount, ok, detail) {
  const time = now().toLocaleTimeString('en-GB', { ... });
  state.transactions.unshift({ amount, ok, detail, time });
}
```

(index.html:562-565.) No cap, no trimming, called on every withdrawal
attempt (success or decline).

## Failure Scenario

Over a very long single-page session (thousands+ of withdrawal attempts
without a reload), `state.transactions` and the corresponding DOM list in
`renderHistory()` (index.html:636-657, which re-renders the *entire* array
into `innerHTML` on every call) would grow without bound, degrading
rendering performance. Given the SUT's realistic use (a short manual
testing session, or an Antithesis run with a bounded number of workload
operations per timeline), this is unlikely to matter in practice.

## Key Observations

Weakest property in the catalog by design — included for completeness
(naming the one unbounded structure) rather than because it's believed to
be a meaningful risk. Expect `evaluation/antithesis-fit.md` to flag this as
low-value or drop it; noted here so that assessment happens explicitly
during evaluation rather than by this property silently never having been
considered.

No open questions.
