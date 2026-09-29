# withdrawal-amount-positive-multiple-of-ten

## Evidence Trail

README edge-input behavior tests: "Withdraw €0 — error, not processed";
"Withdraw a negative amount — rejected"; "Withdraw €300.50 (non-integer) —
rejected; smallest unit is €10." `ideas.md` separately flags "Fix leading
zeroes in asking for money" as a known open item — a related but distinct
input-parsing concern.

## Relevant Code

```js
const amount = parseInt(input.value, 10);
if (!amount || amount <= 0) {
  showMessage('error', 'Please enter a valid amount.');
  return;
}
if (amount % 10 !== 0) {
  showMessage('error', `Amount must be a multiple of &euro;10 ...`);
  return;
}
```

(index.html:491-500.)

## Failure Scenario

- Empty input → `parseInt("", 10) = NaN` → `!amount` is `true` (NaN is
  falsy) → correctly rejected.
- `"0"` → `parseInt = 0` → `!amount` true → correctly rejected.
- `"-50"` → `parseInt = -50` → `amount <= 0` true → correctly rejected.
- `"305"` → `parseInt = 305` → passes the first check, fails `% 10 !== 0`
  → correctly rejected.
- `"007"`-style leading zeros → `parseInt("007", 10) = 7` — parses fine
  numerically; the `ideas.md` note is presumably about *display*
  formatting of leading zeros while typing, not a validation gap, but
  worth confirming that's the actual intent before scoping a property
  around it (see Open Questions).

## Key Observations

This property is the umbrella for README's edge-input tests and holds for
every case checked by hand. Its one interaction worth flagging: the
`amount <= 0` and `% 10 !== 0` checks both operate on the *parsed*
integer, not the *raw string* — which is exactly what makes
`fractional-amount-truncated-not-rejected` possible (a fractional raw
string can parse down to a valid integer). That property is kept separate
because it's about a different failure mode (silent truncation of
information, not failure to reject an invalid amount) even though both
trace through the same two lines of code.

## Open Questions

- Is `ideas.md`'s "Fix leading zeroes in asking for money" about input
  *parsing* (already numerically correct per the trace above) or about
  *display* while typing (e.g., the input field visually showing `007`
  instead of `7`)? Not resolved by code tracing alone — `ideas.md` is a
  one-line backlog note with no further detail. `(needs human input)`
