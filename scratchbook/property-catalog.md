---
sut_path: /Users/maaretp/Documents/cgi-code/atm
commit: a0effb700d2c2df88f5e8502923e039eb60c0e7e
updated: 2026-09-29
external_references: []
---

# Property Catalog — ATM Simulator

19 properties across 8 categories (17 from initial discovery, plus 2 added
during the evaluation pass — see `evaluation/synthesis.md`). Two are
**confirmed live defects** (traced directly in the code, not suspected —
`exact-change-completeness` and `fractional-amount-truncated-not-rejected`),
flagged as such rather than presented as passing guarantees, per
`references/validating-claims.md`.

## Category: Withdrawal Limit Enforcement

The €X/day rule is the entire point of this SUT (`README.md`: "An ATM allows
a daily withdraw limit of 300€"). These properties are the core safety net —
everything else is secondary to getting this right.

### atm-daily-limit-never-exceeded — ATM Daily Limit Never Exceeded

| | |
|---|---|
| **Type** | Safety |
| **Priority** | High — core requirement under test |
| **Property** | The sum of approved (dispensed) withdrawal amounts at the ATM within one "day" never exceeds `atm.dailyLimit`. |
| **Invariant** | `Always`: after every successful `withdraw()` call, `state.atm.withdrawnToday <= state.atm.dailyLimit`. Every-evaluation invariant on committed state — `Always` is the right fit. |
| **Antithesis Angle** | Drive a workload that issues withdrawal sequences straddling the limit (e.g., repeated €100s against a €300 limit) interleaved with admin actions that change `atm.dailyLimit` mid-sequence, and with clock jumps that may or may not cross a day boundary. Antithesis's interleaving search is well suited to finding the one ordering of "withdraw, change limit, withdraw again" that slips past the check. |
| **Why It Matters** | This is the requirement under test (`README.md`). A violation here means the simulator itself gets the one rule it exists to teach wrong. |

**Open Questions:** None.

### account-daily-limit-never-exceeded — Account Daily Limit Never Exceeded (Including Elsewhere)

| | |
|---|---|
| **Type** | Safety |
| **Priority** | High — core requirement under test |
| **Property** | The sum of `withdrawnToday` (this ATM) plus `withdrawnElsewhere` never exceeds `account.dailyLimit` after any successful withdrawal. |
| **Invariant** | `Always`: after every successful `withdraw()`, `state.account.withdrawnToday + state.account.withdrawnElsewhere <= state.account.dailyLimit`. |
| **Antithesis Angle** | Combine withdrawal sequences with mid-sequence edits to `withdrawnElsewhere` (via `setElsewhere()`) and to `account.dailyLimit` (via `applyAdmin()`) — the two ways this sum's components can move independently of a withdrawal. Explore orderings where `withdrawnElsewhere` is raised right before a withdrawal that would otherwise fit. |
| **Why It Matters** | Implements README's "Effective limit rule": `Account remaining = Account daily limit − sum of approved withdrawals across all ATMs today`. This is the multi-ATM half of the rule, simulated via a manually-entered value since the SUT has no second live ATM (see `sut-analysis.md` Focus 12). |

**Open Questions:**

- Is `withdrawnElsewhere` meant to be user-settable at all mid-transaction, or should it be locked once a withdrawal is in flight? Not applicable today (no async gap exists between reading and using it in `withdraw()`), but worth a note if the SUT ever gains any async step. `(needs human input)`

### balance-never-negative — Account Balance Never Goes Negative From a Withdrawal

| | |
|---|---|
| **Type** | Safety |
| **Priority** | Medium — fundamental invariant, low suspected risk |
| **Property** | `state.account.balance` is never decreased below 0 by a withdrawal. |
| **Invariant** | `Always`: after every `withdraw()` call, `state.account.balance >= 0`. |
| **Antithesis Angle** | Drive balance close to zero with a sequence of withdrawals, then attempt an amount exactly equal to, one step above, and one step below the remaining balance, interleaved with limit/clock manipulation to check the balance check isn't accidentally short-circuited by another gate. |
| **Why It Matters** | README's "Withdraw €300 when account balance is €0" test. The check exists (`amount > state.account.balance`, index.html:506) and runs before any state mutation — worth confirming it can't be bypassed by a code path added later. |

**Open Questions:** None.

### declined-withdrawals-dont-consume-limit — Declined Withdrawals Never Mutate Counters

| | |
|---|---|
| **Type** | Safety |
| **Priority** | High — core README behavior test |
| **Property** | A withdrawal that is declined (any reason) leaves `withdrawnToday` (account and ATM), `balance`, and `atm.bills` unchanged. |
| **Invariant** | `Always`: for every call to `withdraw()` that results in `logTransaction(amount, false, ...)`, the pre- and post-call values of `account.balance`, `account.withdrawnToday`, `atm.withdrawnToday`, and `atm.bills` are bitwise identical. |
| **Antithesis Angle** | Force every decline path (over-limit, over-balance, out-of-cash, no-exact-change) and snapshot state immediately before/after each. This is a pure state-diff check, cheap for Antithesis to verify on every declined transaction in a run. |
| **Why It Matters** | Directly states README's behavior test: "Declined attempts do not consume the limit." Confirmed true today by code trace (all four decline branches in `withdraw()`, index.html:506-540, return before the "Commit" block at line 542) — this property exists to keep it true as the code evolves. |

**Open Questions:** None.

## Category: Cash Dispensing Correctness

`dispenseBills()` (index.html:465-481) turns an approved amount into a set
of physical bills. This category treats the allocator itself as the thing
under test, independent of the limit logic above.

### dispensed-amount-matches-requested — Dispensed Bills Sum to Exactly the Requested Amount

| | |
|---|---|
| **Type** | Safety |
| **Priority** | Medium — correctness counterpart to a confirmed-defect area |
| **Property** | Whenever a withdrawal is dispensed, the sum of `denomination × count` across the returned bill set equals the originally requested amount exactly — never more, never less. |
| **Invariant** | `Always`: for every successful `withdraw()`, `Σ(d * dispensed[d] for d in DENOMS) === amount`. |
| **Antithesis Angle** | Not a timing property by itself, but a cheap invariant to check on every dispensed transaction throughout every timeline — catches any future refactor of `dispenseBills()` that introduces rounding or off-by-one errors. |
| **Why It Matters** | The literal contract of an ATM: give exactly what was asked for. `dispenseBills()`'s own `remaining !== 0` check (index.html:479) already enforces this internally — this property verifies that guarantee end-to-end, including the state-mutation step in `withdraw()` (index.html:543-545) that applies the returned map. |

**Open Questions:** None.

### bill-inventory-never-negative — ATM Bill Counts Never Go Negative

| | |
|---|---|
| **Type** | Safety |
| **Priority** | Medium — regression guard on the allocator |
| **Property** | `state.atm.bills[d]` is never negative for any denomination `d`, at any point. |
| **Invariant** | `Always`: after every `withdraw()` and every `applyAdmin()` call, `state.atm.bills[100] >= 0 && ...[50] >= 0 && ...[20] >= 0 && ...[10] >= 0`. |
| **Antithesis Angle** | Drive the ATM's cash inventory to near-zero on selected denominations via repeated withdrawals, then race further withdrawal attempts against admin refills, to search for any subtraction (`state.atm.bills[d] -= dispensed[d]`, index.html:544) that isn't preceded by a sufficient availability check. |
| **Why It Matters** | `dispenseBills()` already bounds `use` by `draft[d]` (index.html:472), so this should always hold — this property exists as a regression guard, and as the natural counterpart to `dispensed-amount-matches-requested`. |

**Open Questions:** None.

### exact-change-completeness — A Feasible Bill Combination Is Always Found When One Exists

| | |
|---|---|
| **Type** | Safety — **CONFIRMED VIOLATED today** |
| **Priority** | High — confirmed live defect, strong Antithesis fit |
| **Property** | If some combination of available bills sums exactly to the requested (already limit- and balance-approved) amount, `dispenseBills()` finds *a* valid combination — it never declines a request that the ATM's cash inventory can actually satisfy. |
| **Invariant** | `Always`, checked against a reference oracle: the workload computes, by exhaustive/DP search over `atm.bills`, whether *any* feasible combination for `amount` exists; if one does, assert `dispenseBills(amount, atm.bills) !== null`. `Always` fits because this must hold on every evaluation, not merely "sometimes" — it is a completeness guarantee, and its current violation is a real bug, not a matter of priority. |
| **Antithesis Angle** | This is a bounded (limited-supply) change-making problem; greedy is not exhaustive. Antithesis's combinatorial search over ATM bill-inventory states (via repeated targeted withdrawals/refills) and withdrawal amounts is exactly the right tool to rediscover this class of counterexample automatically, beyond the one hand-constructed here. |
| **Why It Matters** | **Confirmed by direct trace, not suspected.** With `atm.bills = {100:0, 50:2, 20:3, 10:0}` and `amount = 110`: a valid combination exists — 1×€50 + 3×€20 = €110, within available counts — but `dispenseBills(110, {100:0,50:2,20:3,10:0})` returns `null`. The greedy pass takes `min(floor(110/50), draft[50]) = min(2,2) = 2` fifties first (spending both), leaving a €10 remainder that neither the €20 nor €10 tier (0 available) can close. The ATM shows "Withdrawal denied" for cash it physically has and a valid dispense plan for. See `properties/exact-change-completeness.md` for the full trace and reproduction steps. |

**Open Questions:**

- Should the fix be "make `dispenseBills` exhaustive" (DP/backtracking over the 4 fixed denominations) or "accept the greedy limitation and decline is intentional, document it"? The latter contradicts README's own behavior-test expectations, so the former seems intended — but this is a product decision, not something code tracing alone settles. `(needs human input)`

### within-limit-withdrawal-not-spuriously-declined — Any Limit/Balance/Cash-Feasible Withdrawal Succeeds

| | |
|---|---|
| **Type** | Safety — **currently violated via the `exact-change-completeness` mechanism below** |
| **Priority** | High — generalizes a confirmed live defect |
| **Property** | A withdrawal request that is within both daily limits, within the account balance, and for which the ATM's cash inventory can make exact change, is never declined. |
| **Invariant** | `Always`: given the four independent gates in `withdraw()` (balance, account limit, ATM limit, exact-change), if a reference oracle confirms all four would pass, the actual `withdraw()` call results in a dispensed transaction, not a decline. |
| **Antithesis Angle** | This is the completeness counterpart to the four safety-only properties above (which only check declines happen *when they should*, never that approvals happen *when they should*). Antithesis fuzzing over `(balance, limits, bill inventory, amount)` tuples is well suited to finding the boundary cases where an approval is wrongly withheld — as it already did for the bill-combination case. |
| **Why It Matters** | Generalizes `exact-change-completeness`: that property is one specific *mechanism* (greedy bill allocation) by which this broader completeness guarantee currently fails. Kept as a separate, broader property because a future code change could introduce a different mechanism (e.g., an off-by-one in the limit comparison) that violates this same user-facing guarantee without touching `dispenseBills()` at all. |

**Open Questions:** None beyond the open question already recorded under `exact-change-completeness`.

## Category: Day Boundary and Clock Behavior

Answers (and stress-tests the answer to) README's own oracle question:
"What does 'daily' mean?"

### daily-counters-reset-at-day-boundary — Counters Reset Exactly Once Per Calendar Day

| | |
|---|---|
| **Type** | Liveness |
| **Priority** | High — core README oracle question, timing-sensitive |
| **Property** | When the simulator's effective date (real or simulated via `clockOffset`) advances to a new calendar day, `withdrawnToday` (account and ATM) and `withdrawnElsewhere` are reset to 0 before any further withdrawal is evaluated against the limits. |
| **Invariant** | `Sometimes(cond)` where `cond` = "a day-boundary crossing occurred and, on the very next `checkDayReset()` invocation, all three counters read 0." A progress property — it must become true at least once per crossing, not hold on every evaluation (between crossings the counters are non-zero by design). |
| **Antithesis Angle** | Antithesis can drive the simulated clock (via `applyClock()`) across many different boundary times — exactly at midnight, one second before, one second after, across a DST-affected date in the host's timezone — and confirm the reset fires on the correct side of the boundary every time, including when withdrawals and clock changes interleave within the same second. |
| **Why It Matters** | This is the concrete answer the code gives to README's open question ("Is 'day' a calendar day... or rolling 24-hour window... whose clock?"): calendar day, browser-local timezone, via `Date#toDateString()` (`todayStr()`, index.html:444-446). The property exists to confirm that implementation choice is applied consistently, not just assumed from reading the source once. |

**Open Questions:**

- `toDateString()` is evaluated in whatever timezone the browser/OS reports. Antithesis's execution environment's timezone (and whether it's held fixed or varied across runs) will change what "midnight" means for this property. `(needs human input)`

### clock-rewind-resets-counters — Rewinding the Simulated Clock Also Resets Counters

| | |
|---|---|
| **Type** | Safety — **CONFIRMED VIOLATED today, by design of the admin debug feature** |
| **Priority** | High — confirmed reachable bypass mechanism |
| **Property** | Daily counters should only reset when real wall-clock time actually advances past a day boundary — not when the *simulated* clock is moved backward across one, and not a second time when it's then moved forward again across the same boundary. |
| **Invariant** | `Always` (if adopted as a real guarantee): `state.resetDate` transitions monotonically forward in calendar-day terms as real time elapses, regardless of how many times the simulated clock is set backward/forward across the same boundary within that real-time window. Framed as `Reachable` instead if the finding is only meant to be documented, not fixed: `Reachable("counters reset via clock rewind")` — confirms the bypass path is reachable so it stays visible in future runs. |
| **Antithesis Angle** | Drive `applyClock()` back and forth across a day boundary interleaved with withdrawals near the daily limit, and check whether the limit can be exceeded (measured in real, non-simulated elapsed time) purely by clock manipulation. |
| **Why It Matters** | `checkDayReset()` (index.html:448-457) compares `state.resetDate !== todayStr()` by string inequality — it has no notion of "did time move forward." Setting the clock to yesterday changes `todayStr()`, triggers a reset (clearing counters as if a real day passed), and setting it forward again triggers a second reset. Directly answers README's oracle question "Client-side time manipulation — does moving the clock forward trigger a reset?" — yes, and so does moving it backward. **Scope caveat:** the clock control is admin/debug-only tooling meant for testers to construct day-boundary scenarios, not a customer-facing surface — so whether this is "the bug" or "the feature working as intended for its debug purpose" is a product call, not a code-tracing call. |

**Open Questions:**

- Is clock-rewind-causes-reset the intended behavior of the debug tool (it exists to let a tester manufacture exactly this scenario), or should the debug tool be guarded so it can't accidentally demonstrate a limit bypass that wouldn't be reachable in a non-debug build? `(needs human input)`

## Category: Admin/Debug Configuration Consistency

The ADMIN and DEBUG panels are the mechanism by which a human tester
constructs README's boundary scenarios. If they're internally inconsistent,
the tool undermines its own purpose.

### withdrawn-elsewhere-bounded — "Withdrawn At Other ATMs" Never Exceeds the Account Daily Limit

| | |
|---|---|
| **Type** | Safety |
| **Priority** | Medium — this session's fix; real but precision-level |
| **Property** | `state.account.withdrawnElsewhere` never exceeds `state.account.dailyLimit`, whether set directly via the debug input or indirectly by the admin panel lowering `dailyLimit` afterward. |
| **Invariant** | `Always`: after `setElsewhere()` and after `applyAdmin()`, `state.account.withdrawnElsewhere <= state.account.dailyLimit`. |
| **Antithesis Angle** | Interleave `setElsewhere(v)` calls with `applyAdmin()` calls that raise/lower `dailyLimit`, searching for an ordering that leaves `withdrawnElsewhere` stranded above the (now current) limit. |
| **Why It Matters** | This is the property behind the fix applied earlier this session (`setElsewhere()`, index.html:459-463, and the re-clamp in `applyAdmin()`, index.html:701). Before the fix, the debug input had no upper bound at all, so a tester could set an internally-impossible "withdrawn elsewhere" value larger than the account's entire daily limit. |

**Open Questions:**

- The fix clamps `withdrawnElsewhere` to `dailyLimit` alone, not to `dailyLimit - withdrawnToday`. It's still possible for `withdrawnToday + withdrawnElsewhere` to exceed `dailyLimit` today (e.g., withdraw €400 at this ATM against a €500 limit, then set "elsewhere" to €500). The effect is safe — `account-daily-limit-never-exceeded` still holds because `accRemaining` goes negative and every subsequent withdrawal is declined — but it means the debug input can still be set to a value that's individually "impossible" relative to same-day activity at this ATM. Is tightening the bound to `dailyLimit - withdrawnToday` worth doing, or is the current behavior (safe, just not maximally precise) good enough for a debug input? `(partial: confirmed the failure direction is over-blocking, not over-permitting — see Investigation Log)` |

### admin-limit-reduction-blocks-overdrawn-account — Lowering the Account Limit Mid-Day Never Permits a New Withdrawal Beyond It

| | |
|---|---|
| **Type** | Safety |
| **Priority** | Medium — confirms a display/gating asymmetry stays safe |
| **Property** | If an admin lowers `account.dailyLimit` below the amount already withdrawn today (`withdrawnToday + withdrawnElsewhere`), no further withdrawal is approved until the counters reset for a new day. |
| **Invariant** | `Always`: whenever `state.account.dailyLimit < state.account.withdrawnToday + state.account.withdrawnElsewhere`, every subsequent `withdraw()` call in the same day results in a decline. |
| **Antithesis Angle** | Sequence: withdraw close to an initial limit, lower the limit below what's already spent via `applyAdmin()`, then fuzz further withdrawal amounts (including very small ones) to confirm none slip through a signed-arithmetic or off-by-one edge in the `accRemaining` computation (`withdraw()`, index.html:502, deliberately **not** clamped to 0, unlike the display-only `Math.max(0, ...)` in `render()`, index.html:577). |
| **Why It Matters** | Verifies the two "remaining" computations — the display one in `render()` and the gating one in `withdraw()` — stay consistent in the direction that matters (gating) even though only one of them is clamped to zero. A divergence between a display value and a gating value is a classic source of confusing-but-not-unsafe bugs, worth confirming stays on the safe side. |

**Open Questions:** None.

## Category: Input Validation

### withdrawal-amount-positive-multiple-of-ten — Only Positive Multiples of €10 Are Ever Dispensed

| | |
|---|---|
| **Type** | Safety |
| **Priority** | Medium — README edge cases; weak Antithesis fit per evaluation |
| **Property** | A withdrawal is only ever dispensed for an amount that is a positive integer and an exact multiple of 10 (the smallest bill denomination). |
| **Invariant** | `Always`: for every successful `withdraw()`, `amount > 0 && amount % 10 === 0 && Number.isInteger(amount)`. |
| **Antithesis Angle** | Fuzz `#amountInput` values including empty string, `"0"`, negative numbers, non-numeric strings, and values with leading zeros (flagged in `ideas.md` as a known-open item: "Fix leading zeroes in asking for money"). |
| **Why It Matters** | Directly matches README's edge-input behavior tests (€0, negative, non-multiple amounts all rejected). The `Number.isInteger` conjunct is what `fractional-amount-truncated-not-rejected` below shows is currently unenforced for the *input string*, even though it holds for the *parsed* value by construction of `parseInt`. |

**Open Questions:**

- Is `ideas.md`'s "Fix leading zeroes in asking for money" about input parsing (already numerically correct) or about display while typing? `(needs human input)`

### fractional-amount-truncated-not-rejected — Fractional Amount Input Is Silently Truncated, Not Rejected

| | |
|---|---|
| **Type** | Safety — **CONFIRMED VIOLATED today** |
| **Priority** | High — confirmed live defect; silently changes dispensed amount |
| **Property** | An amount input containing a fractional part (e.g., `"300.50"`) should be rejected with an error, matching README's own behavior test ("Withdraw €300.50 (non-integer) — rejected"), not silently coerced to a valid integer amount. |
| **Invariant** | `Always` (once fixed): if the raw input string is not itself a valid integer literal, `withdraw()` shows an error and dispenses nothing. Today: `Unreachable` would be the honest assertion type for "a fractional input string reaches the dispense branch" — because it currently *is* reachable, which is the bug. |
| **Antithesis Angle** | Not a fault-injection property in the traditional sense — this is deterministic on any single fixed input and doesn't need interleaving or partial failure to reproduce. Flagged here for completeness; see `evaluation/antithesis-fit.md` for the assessment of whether it belongs in an Antithesis-run catalog at all versus a plain unit test. |
| **Why It Matters** | **Confirmed by direct trace of JS semantics**, not suspected: `parseInt(input.value, 10)` (index.html:491) truncates at the first non-digit character, so `parseInt("300.5", 10) === 300`. Because `300 % 10 === 0`, the truncated value passes the multiple-of-10 check (index.html:497) and the withdrawal proceeds for €300 with no indication to the user that ".5" was dropped. This is JS's documented `parseInt` behavior, verifiable without running anything — the discriminating detail is the call site and argument, not a guess about behavior. |

**Open Questions:** None — mechanism is fully understood from `parseInt`'s specification and the call site; no further investigation needed.

## Category: State Lifecycle

### no-state-persistence-across-reload — State Resets to Hardcoded Defaults on Reload

| | |
|---|---|
| **Type** | Reachability |
| **Priority** | Low — baseline tripwire; weak Antithesis fit per evaluation |
| **Property** | A page reload always returns the simulator to the exact hardcoded default state (balance €2000, account limit €500, ATM limit €300, bills 5/8/15/20), regardless of what state existed before the reload. |
| **Invariant** | `Reachable`: the default-state values are observed immediately after a fresh page load, in every run, confirming no code path accidentally introduces persistence (e.g., a stray `localStorage` call) that would make this Reachability goal fail to hold. |
| **Antithesis Angle** | Low value for interleaving/fault-injection search specifically — there's no persistence mechanism to attack. Included for portfolio completeness (see `evaluation/coverage-balance.md`) and as a tripwire: if this ever stops being trivially true, something meaningfully changed in the SUT's persistence model. |
| **Why It Matters** | Establishes a baseline every other property implicitly assumes: each timeline starts from the same known state, with no carryover from a previous timeline via browser storage. |

**Open Questions:** None.

## Category: User-Facing Feedback Accuracy

### decline-reason-not-surfaced — Decline Message Doesn't State the Reason or Remaining Amount

| | |
|---|---|
| **Type** | Safety — **currently violated relative to README's own spec** |
| **Priority** | Medium — real spec/implementation gap; weak Antithesis fit |
| **Property** | On a declined withdrawal, the message shown to the user states the specific reason (matching README's distinction: "limit reached" vs. "insufficient funds") and how much remains available today — not a generic denial. |
| **Invariant** | `Always` (once implemented): the DOM text in `#messageBox` after a decline is drawn from the same `detail` string already computed and passed to `logTransaction()` (e.g., `'Account daily limit reached'`, `'ATM out of cash'`), not the literal constant `'Withdrawal denied.'`. |
| **Antithesis Angle** | Weak fit for fault injection — this is a straightforward "does the UI show field X" check, reproducible with a single fixed scenario per decline reason. Flagged for the evaluation pass (Antithesis Fit lens) rather than assumed to belong in a fault-injection run. |
| **Why It Matters** | Every one of the four decline branches in `withdraw()` (index.html:506-540) already computes a specific reason string and stores it via `logTransaction(amount, false, reason)` — it's only ever displayed in the DEBUG panel's transaction history, never in the main-screen `showMessage('error', 'Withdrawal denied.')` call. README explicitly calls out both details as expected behavior tests ("error message states how much remains today, not just 'declined'"; "message says 'limit reached', not 'insufficient funds'") — the code already has the data, it's just not wired to the visible message. |

**Open Questions:** None — the gap and the fix location are both fully traced.

## Category: Exploration Guidance

Added during the evaluation pass (`evaluation/coverage-balance.md`) to
correct an assertion-type imbalance: the discovery pass produced 14
`Always` properties and only 1 `Sometimes`, with nothing steering
Antithesis's search toward the specific states (all decline reasons hit, a
denomination run to zero) that make the confirmed dispensing defect, and
others like it, more likely to surface.

### atm-decline-reasons-explored — All Five Decline Reasons Are Observed At Least Once

| | |
|---|---|
| **Type** | Reachability |
| **Priority** | Medium — exploration guidance supporting a High-priority property |
| **Property** | Over the course of a run, each of the five decline branches in `withdraw()` (insufficient balance, account limit reached, ATM limit reached, ATM out of cash, cannot make exact change) is reached at least once. |
| **Invariant** | `Reachable`, one instance per branch, using the distinct `detail` strings already computed at each site (index.html:507, 514, 521, 528, 536) as the discriminating outcome. |
| **Antithesis Angle** | Pure exploration guidance — doesn't verify correctness by itself, but tells Antithesis's search that visiting all five decline reasons (not just the easy-to-reach "insufficient balance" case) is worth prioritizing, increasing the chance of surfacing `exact-change-completeness`-class bugs specifically (reached via the fifth branch). |
| **Why It Matters** | Without this, nothing signals that the "cannot make exact change" branch — the one with a confirmed defect behind it — is an interesting state to reach, versus the much-easier-to-hit "insufficient balance" branch dominating the search. |

**Open Questions:** None.

### atm-denomination-exhausted — At Least One Bill Denomination Reaches Zero During a Run

| | |
|---|---|
| **Type** | Liveness |
| **Priority** | Medium — exploration guidance supporting a High-priority property |
| **Property** | Over the course of a run, `state.atm.bills[d]` reaches exactly 0 for at least one denomination `d` while other denominations remain available. |
| **Invariant** | `Sometimes(cond)` where `cond` = "some `bills[d] === 0` while `Σ bills[d'] for d' != d > 0`" — a meaningful semantic state (partial exhaustion), not a trivially-true condition. |
| **Antithesis Angle** | This is the precondition that made `exact-change-completeness`'s confirmed bug possible — the counterexample required exactly this shape of inventory (`{100:0, 50:2, 20:3, 10:0}`, two denominations exhausted). Hinting Antithesis toward partial-exhaustion states increases the odds of finding further counterexamples beyond the one hand-constructed one. |
| **Why It Matters** | Directly targets the highest-value confirmed-defect area in the catalog; without this hint, a workload that keeps the ATM comfortably stocked between withdrawal sequences would rarely construct the lopsided inventory states the greedy allocator fails on. |

**Open Questions:** None.

## Category: Resource Boundaries

### transaction-history-bounded-growth — Transaction Log Does Not Grow Without Bound Within a Session

| | |
|---|---|
| **Type** | Liveness / Reachability (weak) |
| **Priority** | Low — impractical within timeline limits per evaluation |
| **Property** | `state.transactions` does not grow indefinitely across a very long single-page session — either it's capped, or unbounded growth here is an accepted, explicitly-scoped limitation. |
| **Invariant** | `Reachable` at best: "a very long transaction sequence completes without the page becoming unresponsive" is closer to a performance smoke check than a true invariant. No natural `Always`/`Sometimes` framing fits well. |
| **Antithesis Angle** | Weak fit — this is closer to a soak/performance concern than a fault-injection target, and the SUT is a short-lived teaching demo where a session realistically involves dozens, not millions, of transactions. **Evaluation pass confirmed this is impractical within normal Antithesis timeline limits** (`evaluation/implementability.md`) — kept in the catalog for portfolio completeness but marked low priority / candidate for exclusion from the initially-implemented property set. |
| **Why It Matters** | `state.transactions.unshift(...)` (index.html:564) is never trimmed. Low real-world impact given the SUT's intended use, but it's the one genuinely unbounded data structure in the codebase, so it's named here rather than silently skipped. |

**Open Questions:** None.
