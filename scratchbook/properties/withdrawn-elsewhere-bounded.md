# withdrawn-elsewhere-bounded

## Evidence Trail

Arose directly from a fix applied in this session, prompted by the user
observing: "Looks like there is no upper boundary value set for 'withdrawn
at other ATMs', and there should be. It can be at most account limit value
set at the time." This property formalizes that fix as a checkable
invariant going forward.

## Relevant Code — Before the Fix

```js
function setElsewhere(val) {
  state.account.withdrawnElsewhere = Math.max(0, parseInt(val) || 0);
  render();
}
```

No upper bound at all — a tester could type e.g. `999999` into the
"Withdrawn at other ATMs" debug input regardless of the account's actual
daily limit.

## Relevant Code — After the Fix (current, commit a0effb70)

```js
function setElsewhere(val) {
  const parsed = Math.max(0, parseInt(val) || 0);
  state.account.withdrawnElsewhere = Math.min(parsed, state.account.dailyLimit);
  render();
}
```

Plus, in `render()`: `elsewhereInput.max = acc.dailyLimit;` (keeps the
HTML `max` attribute in sync for native browser-level clamping/UX), and in
`applyAdmin()`: `state.account.withdrawnElsewhere =
Math.min(state.account.withdrawnElsewhere, state.account.dailyLimit);`
(re-clamps if an admin lowers `dailyLimit` below an already-set
`withdrawnElsewhere`).

## Failure Scenario (Pre-Fix, No Longer Reproducible)

Set `dailyLimit = 500`, then `setElsewhere(9999)` → `withdrawnElsewhere =
9999`. `accRemaining = 500 - 0 - 9999 = -9499`. Every subsequent withdrawal
gets declined (since `amount > accRemaining` for any positive `amount`) —
so the pre-fix bug was *safe* in effect (over-blocks, doesn't over-permit)
but represented an internally nonsensical state: more "withdrawn elsewhere"
than the account's entire daily allowance, which is impossible in the
real-world model README describes.

## Key Observations — Precision Gap That Survives the Fix

The fix bounds `withdrawnElsewhere <= dailyLimit`, not `withdrawnElsewhere
<= dailyLimit - withdrawnToday`. So it's still possible to reach an
internally-tight-but-not-impossible-looking state: e.g. `dailyLimit = 500`,
withdraw `€400` at this ATM (`withdrawnToday = 400`), then
`setElsewhere(500)` → clamped to `500` (equal to `dailyLimit`, passes the
current bound) even though only `€100` of "elsewhere" capacity is actually
left. `accRemaining` becomes `500 - 400 - 500 = -400` — still safe
(over-blocks), but the debug input itself now holds a value
(`withdrawnElsewhere = 500`) that's individually implausible given
same-session activity at this ATM.

## Investigation Log

### Does the current (post-fix) bound ever allow an actually-unsafe state, or only an imprecise-but-safe one?

- Examined: `setElsewhere()` (index.html:459-463), `applyAdmin()`'s
  re-clamp (index.html:701), and the gate computation `accRemaining =
  dailyLimit - withdrawnToday - withdrawnElsewhere` (index.html:502) used
  directly in `withdraw()`'s decline check (index.html:513).
- Found: `accRemaining` is **not** clamped to a minimum of 0 at the point
  it's used for gating (only the display copy in `render()`,
  index.html:577, uses `Math.max(0, ...)`). This means even if
  `withdrawnElsewhere` is set to a value that makes `accRemaining` deeply
  negative, the gate `amount > accRemaining` still correctly declines
  every positive `amount` (a positive number is always greater than a
  negative one) — traced this arithmetic explicitly, no edge case where a
  specific `amount` could satisfy `amount <= accRemaining` when
  `accRemaining < 0`, since `amount > 0` is already enforced earlier
  (index.html:493-496).
- Not found: no scenario, across the combinations tried by hand (varying
  `dailyLimit`, `withdrawnToday`, and the clamped `withdrawnElsewhere`),
  where the current bound (`<= dailyLimit` alone) permits an actual
  over-limit dispense. The gap is real but its effect is confirmed
  over-blocking, not over-permitting.
- Conclusion: tagged `(partial: confirmed the failure direction is
  over-blocking, not over-permitting)` on the catalog entry. Whether it's
  worth tightening the bound to `dailyLimit - withdrawnToday` for
  precision (so the debug input can't hold an individually-implausible
  value) versus leaving it as-is (safe, simpler) is a product/UX call, not
  something the safety analysis alone resolves.
