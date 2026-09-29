# exact-change-completeness

## Evidence Trail

`README.md`'s own oracle-question list gestures at this area without
resolving it: "ATM has only €20 bills — €300 cannot be made exactly;
declined (€290 or €300?)" — the author already suspected denomination edge
cases were interesting but, by the author's own framing, treated them as
*ambiguous requirements* rather than *algorithmic bugs*. Tracing
`dispenseBills()` (index.html:465-481) directly shows it's actually the
latter, at least in this specific case: not every case where cash "should"
be decline-able-with-ambiguity is even a case where a valid combination
exists — sometimes the greedy algorithm fails to find one that clearly
does exist.

## Relevant Code

```js
function dispenseBills(amount, bills) {
  const result = {};
  let remaining = amount;
  const draft = { ...bills };

  for (const d of DENOMS) {           // DENOMS = [100, 50, 20, 10]
    if (remaining <= 0) break;
    const use = Math.min(Math.floor(remaining / d), draft[d]);
    if (use > 0) {
      result[d] = use;
      remaining -= use * d;
    }
  }

  if (remaining !== 0) return null;   // can't make exact change
  return result;
}
```

(index.html:465-481, reproduced verbatim for reference.)

## Failure Scenario — Reproduced By Direct Trace

Inputs: `amount = 110`, `bills = { 100: 0, 50: 2, 20: 3, 10: 0 }`.

Step-by-step execution:

1. `d = 100`: `remaining = 110`. `use = min(floor(110/100), draft[100]) =
   min(1, 0) = 0`. Skipped (not `> 0`).
2. `d = 50`: `use = min(floor(110/50), draft[50]) = min(2, 2) = 2`.
   `result[50] = 2`. `remaining = 110 - 100 = 10`.
3. `d = 20`: `use = min(floor(10/20), draft[20]) = min(0, 3) = 0`. Skipped.
4. `d = 10`: `use = min(floor(10/10), draft[10]) = min(1, 0) = 0`. Skipped.
5. Loop ends. `remaining = 10 !== 0` → **returns `null`**.

But a valid combination exists and was never tried: **1×€50 + 3×€20 =
50 + 60 = 110**, using only 1 of the 2 available €50 bills and all 3
available €20 bills — both within inventory. The greedy algorithm never
considers "use fewer €50s to leave room for more €20s" because it commits
to the maximum count of each denomination (bounded only by need and
availability) before moving to the next, with no backtracking.

In `withdraw()`, this null result is treated identically to "the ATM
genuinely cannot make this amount": `logTransaction(amount, false, 'Cannot
make exact change'); showMessage('error', 'Withdrawal denied.');`
(index.html:535-539). The user sees a flat denial with no indication the
ATM actually holds sufficient, correctly-denominated cash.

## Why This Is a Real Defect, Not a Modeling Choice

Per `references/validating-claims.md`, the bar for calling this a confirmed
defect (not a lead) is having the discriminating primary evidence in hand —
here, the full execution trace above, which is deterministic and
reproducible from the source as committed (`a0effb700d2c2df88f5e8502923e039eb60c0e7e`).
This is not a report from an external source; it's a direct trace against
the actual algorithm, satisfying the strictest bar in the validation
guidance.

## Is This Denomination Set "Canonical"?

Worth recording since it's the kind of thing expensive to rediscover: for
**unlimited-supply** change-making, `{100, 50, 20, 10}` (equivalently
`{10, 5, 2, 1}` after dividing by 10) is a canonical system — greedy always
finds the minimum-coin solution when one exists, and one always exists for
any amount above 0 given infinite supply. The bug here is specific to
**bounded supply**: greedy's local "take as many as I can afford and have"
choice at a large denomination can strand the algorithm even though the
denomination system is canonical in the unlimited-supply sense. This
distinction matters for anyone fixing it — the fix isn't "pick a different
greedy order," it's "make the allocator exhaustive" (e.g., bounded
knapSack-style DP over the 4 fixed denominations and their available
counts, which is a small, tractable search space).

## Suggested SUT-Side Instrumentation

`dispenseBills()` returning `null` is the natural instrumentation point.
Consider an `AlwaysOrUnreachable` or `Unreachable` SUT-side assertion at the
`return null` line, gated on a workload-computed "a feasible combination
exists" oracle, so failures are caught exactly where they occur rather than
only inferred from `withdraw()`'s outward decline. No existing Antithesis
instrumentation exists anywhere in the codebase (`existing-assertions.md`)
— this would be new.

## Investigation Log

### Should the fix be an exhaustive allocator, or is the greedy decline intentional?

- Examined: `dispenseBills()` (index.html:465-481) in full; `withdraw()`'s
  handling of its `null` return (index.html:527-540); `README.md`'s
  denomination-interaction behavior tests (lines 119-124) and oracle
  questions (lines 168-171); `ideas.md` (3 lines, no mention of dispensing
  algorithm correctness).
- Found: README's own behavior tests assume exact-match dispensing succeeds
  whenever physically possible ("ATM has only €50 bills — €300 dispensed as
  six €50s") and only frames *true* infeasibility as ambiguous ("€290 or
  €300?" — a case where no exact combination exists at all, which is a
  different, legitimate situation from the one traced above). Nothing in
  README or `ideas.md` acknowledges the greedy algorithm can be incomplete;
  no code comment claims greedy is a deliberate, accepted trade-off either
  (the file has no comments at all).
- Not found: no design note, issue, or commit message discussing the
  dispensing algorithm's completeness. `git log` (5 commits: "Add ideas for
  further features", "Add cards and favicon", "Update model", "Fix", "Fix a
  problem") gives no titles suggesting this was previously known.
- Conclusion: tagged `(needs human input)` — the mechanism and its
  incorrectness are fully confirmed by trace, but whether to invest in an
  exhaustive allocator (vs. accepting greedy's limitation as an
  intentional, documented simplification for a teaching tool) is a product
  decision the evidence here doesn't settle either way.
