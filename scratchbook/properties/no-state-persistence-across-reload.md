# no-state-persistence-across-reload

## Evidence Trail

Follows directly from `sut-analysis.md` Focus 2 (State Management): the
entire `state` object is a single in-memory JS object literal
(index.html:423-438), created fresh on script execution with no
`localStorage`, `sessionStorage`, cookies, or network calls anywhere in the
file (confirmed by full-text scan alongside the `existing-assertions.md`
scan — no such APIs referenced).

## Relevant Code

```js
const state = {
  account: { balance: 2000, dailyLimit: 500, withdrawnToday: 0, withdrawnElsewhere: 0 },
  atm: { dailyLimit: 300, withdrawnToday: 0, bills: { 100: 5, 50: 8, 20: 15, 10: 20 } },
  clockOffset: 0,
  resetDate: new Date().toDateString(),
  transactions: []
};
```

(index.html:423-438.)

## Failure Scenario

None expected — included as a baseline/tripwire property rather than a
suspected defect. If a future change introduced any persistence (even
accidentally, e.g. a debugging `localStorage.setItem` left in), this
property would catch the resulting cross-timeline state leakage, which
would otherwise silently invalidate every other property's assumption of a
known starting state per timeline.

## Key Observations

Every other property in this catalog implicitly assumes each Antithesis
timeline starts from the exact default state shown above. This property
makes that assumption explicit and checkable rather than leaving it
implicit.

No open questions.
