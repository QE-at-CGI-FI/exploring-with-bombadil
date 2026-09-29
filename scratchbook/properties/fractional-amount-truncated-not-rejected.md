# fractional-amount-truncated-not-rejected

## Evidence Trail

README states the expected behavior explicitly as a behavior test (not an
oracle/ambiguous one): "Withdraw €300.50 (non-integer) — rejected; smallest
unit is €10." This is a claim with a knowable right answer, per README's
own categorization — making the code's actual behavior directly checkable
against it.

## Relevant Code

```js
const input = document.getElementById('amountInput');
const amount = parseInt(input.value, 10);

if (!amount || amount <= 0) { ... return; }
if (amount % 10 !== 0) { ... return; }
```

(index.html:490-500.)

## Failure Scenario — Confirmed by JS Semantics, No Execution Needed

`parseInt` truncates at the first character that isn't a valid digit for
the given radix — this is documented `parseInt` behavior, not
implementation-specific. `parseInt("300.5", 10)` evaluates to `300`
(the `.5` is simply never consumed). Consequences:

- `amount = 300` (not `NaN`, not `300.5`) → passes `!amount` check.
- `300 <= 0` is `false` → passes.
- `300 % 10 === 0` → passes.
- Withdrawal proceeds for exactly `€300`, with **no** indication to the
  user that the `.50` portion of their input was silently dropped.

This differs qualitatively from `"305"` (rejected, correctly, by the
`% 10` check) — a fractional amount that happens to truncate down to a
*multiple of 10* sails through undetected, while one that truncates to a
non-multiple (e.g. `"305.7"` → `305`, still fails `% 10`) happens to get
caught, but only as an accident of the truncated value, not because the
fractional input itself was recognized as invalid.

## Why No Further Investigation Was Needed

Per `references/validating-claims.md`, the standard for a confirmed defect
is discriminating primary evidence "that exhibits the behavior." `parseInt`'s
truncation-not-rounding, stop-at-first-invalid-character behavior is
specified by the ECMAScript standard and is exhibited by the exact call
site quoted above — no ambiguity, no competing explanation to rule out (this
isn't a third-party bug report where "misconfiguration" is a plausible
alternative; it's this codebase's own call to a fully-specified built-in).

## Suggested Fix Direction (Not Prescriptive)

The natural fix is validating the *raw string* before parsing — e.g.
rejecting any input containing a decimal point, or comparing
`String(amount) !== input.value.trim()` after parsing — rather than only
validating the parsed number. Left as an implementation choice, not
specified further here (evidence files record what's known, not design
the fix).

## Investigation Log

Not required — no `(partial: ...)` or `(needs human input)` tag on this
property's catalog entry. The mechanism was fully resolved from the
ECMAScript specification and the exact call site with no remaining
ambiguity; see "Why No Further Investigation Was Needed" above in place of
a separate log.
