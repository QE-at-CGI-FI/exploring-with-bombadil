# dispensed-amount-matches-requested

## Evidence Trail

Implicit contract of any cash dispenser; README's denomination tests all
assume the dispensed total equals the requested amount exactly ("ATM has
only €50 bills — €300 dispensed as six €50s").

## Relevant Code

- `dispenseBills(amount, bills)`, index.html:465-481: builds `result` by
  greedily consuming denominations, tracks `remaining`, and explicitly
  returns `null` if `remaining !== 0` at the end (index.html:479) — this is
  the internal self-check that already enforces this property when a
  result is returned at all.
- `withdraw()` applies the returned map directly to `atm.bills`
  (index.html:543-545) with no further arithmetic — so end-to-end
  correctness reduces to `dispenseBills`'s own internal check.

## Failure Scenario

None currently plausible from code trace — `dispenseBills` cannot return
a non-null result whose sum differs from `amount`, by construction. Kept
as a property because it's the direct, cheap way to verify that invariant
holds end-to-end (including the DOM rendering step, `billsHtml` at
index.html:553-556) rather than trusting the internal check alone.

## Key Observations

Distinct from `exact-change-completeness`: this property is about
correctness *when a dispense happens* (never dispense the wrong amount);
that property is about completeness (never wrongly refuse to dispense when
a valid combination exists). Both should be in the catalog since they
guard against opposite failure directions of the same function.

No open questions.
