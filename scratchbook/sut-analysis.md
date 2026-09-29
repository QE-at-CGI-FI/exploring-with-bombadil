---
sut_path: /Users/maaretp/Documents/cgi-code/atm
commit: a0effb700d2c2df88f5e8502923e039eb60c0e7e
updated: 2026-09-29
external_references: []
---

# SUT Analysis — ATM Simulator

## Summary

The system under test is `index.html` (~720 lines): a single static HTML file
containing inline CSS and a vanilla-JS ATM withdrawal simulator. It is
explicitly a teaching artifact — see `README.md`: "A test target for a
requirements exercise for teaching testing." There is no server, no network
I/O, no build step, and no persistence layer. All state lives in one
in-memory JS object (`state`) that is created fresh on page load and lost on
reload.

`README.md` additionally documents the author's own requirements model
(Cardholder/Card/Account/ATM/Withdrawal/Day concepts, an "effective limit
rule", and a long list of "oracle tests" — questions the €300/day requirement
leaves open). This is unusually good grounding: it is simultaneously a design
note (claimed rules) and a pre-existing list of edge cases the author already
identified as worth probing. Both are treated per
`references/validating-claims.md` — as leads, checked against the actual code
in `index.html`, not assumed true.

**Method note:** given the system's size and complete absence of
concurrency/network/persistence, this analysis was produced in single-agent
mode (sequential pass through the 12 attention focuses) rather than an agent
ensemble — an ensemble's marginal value is low for a 720-line single-file
client-side script that one pass can read in full.

## 1. Architecture and Data Flow

Single entrypoint: the inline `<script>` block at the bottom of `index.html`
(lines 420-717), executed top-to-bottom on page load, ending with a call to
`render()`. There is no routing, no HTTP layer, no serialization boundary —
"requests" are DOM events (`onclick`, `oninput`, `keydown`) that call plain
JS functions synchronously.

Core flow: `withdraw()` (index.html:487-560) reads `#amountInput`, validates
it, computes remaining limits, calls `dispenseBills()` to allocate physical
bills, mutates `state`, logs a transaction, and calls `render()` to
re-paint the DOM from `state`. Every step runs synchronously in one JS
tick — there is no `await`, `setTimeout`, or `fetch` in the withdrawal path.

## 2. State Management and Persistence

All state is the single global `state` object (index.html:423-438):

```js
state = {
  account: { balance, dailyLimit, withdrawnToday, withdrawnElsewhere },
  atm: { dailyLimit, withdrawnToday, bills: {100,50,20,10} },
  clockOffset, resetDate, transactions: []
}
```

No `localStorage`/`sessionStorage`/cookies/backend — a page reload resets to
the hardcoded defaults in the object literal (balance €2000, account limit
€500, ATM limit €300, bills 5×€100/8×€50/15×€20/20×€10). There is exactly one
simulated ATM and one simulated account; the README's Card/Cardholder/
multi-Account model is not implemented — "withdrawn at other ATMs" is a
single manually-entered number (`state.account.withdrawnElsewhere`), not a
second live ATM instance.

`state.transactions` is an unbounded array (`unshift`, never trimmed) — grows
for the lifetime of the page session. Low-risk given the SUT is a
short-lived teaching demo, but worth naming (see Resource Boundaries in
`property-discovery.md` focus 5).

## 3. Concurrency Model

None. Single-threaded, synchronous JS, no Web Workers, no async operations
in the transaction path. `setInterval` (index.html:711-714) only ticks the
clock display and calls `checkDayReset()` once a second — it cannot
interleave with a `withdraw()` call because JS's event loop runs one handler
to completion before the next. Two rapid clicks on WITHDRAW produce two
fully sequential calls to `withdraw()`, not an interleaved race — this is
correct, not a bug, but it also means the SUT cannot itself exhibit the
concurrent-withdrawal races the README's oracle questions ask about ("Two
ATMs used simultaneously by the same card"). See Focus 7 below.

## 4. Safety Guarantees (Claimed)

From `README.md`'s "Effective limit rule" and behavior-test list — claims,
not verified facts:

- `available = min(ATM remaining, Account remaining, Account balance)`
- A withdrawal is approved only when `requested ≤ available` **and** the ATM
  can make exact change for that amount.
- Declined attempts do not consume the daily limit.
- Withdrawal amount must be a positive multiple of €10 (smallest bill).

Cross-checked against the code (`withdraw()`, index.html:487-560): the first
three claims hold in the code's gating logic. The fourth is enforced by
`amount % 10 !== 0` (index.html:497) — **but** `parseInt(input.value, 10)`
(index.html:491) silently truncates a fractional string like `"300.5"` to
`300` before that check runs, so a non-integer amount is silently coerced
rather than rejected, contradicting README's own stated expectation
("Withdraw €300.50 — rejected"). This is a confirmed code-vs-spec gap, not
a guess — see `properties/fractional-amount-truncated-not-rejected.md`.

## 5. Liveness Guarantees (Claimed)

- Daily counters reset once the "day" changes (implicit in the €300/day
  framing and in the existence of `checkDayReset()`).
- A valid, in-limit, in-balance withdrawal for which the ATM holds the
  necessary cash succeeds (implicit completeness counterpart to the safety
  rule above — README doesn't state it explicitly but the whole exercise
  assumes it).

The code answers README's own open "what does day mean?" oracle question:
`todayStr()` uses `Date#toDateString()` — a **calendar-day boundary in the
browser's local timezone**, using either real time or the simulated
`clockOffset` set via the admin Clock panel (index.html:440-457). This is a
concrete design decision worth turning into a property (does the reset
actually fire exactly at that boundary, not before/after).

## 6. Bug History and Density

No issue tracker, no git history beyond the working tree (`git log` shows 5
commits: "Add ideas for further features", "Add cards and favicon", "Update
model", "Fix", "Fix a problem", plus a same-session fix adding an upper
bound to `withdrawnElsewhere`). Too little history to identify hotspots by
churn. Given that, this analysis leans on direct code tracing instead of bug
history for finding defects — and found two by tracing execution rather than
by report (see Focus 11).

## 7. Existing Test Strategy

No test files, test runner, or CI config found in the repository (only
`README.md`, `ideas.md`, `index.html`, `image.png`, `.vscode/settings.json`).
`README.md` is itself a worked *example* of manual test design (a teaching
document), not an automated suite. Everything in the property catalog below
is net-new coverage.

## 8. Failure and Degradation Modes

No retries, no timeouts, no circuit breakers — there's nothing to retry
against (no network). "Failure" here means a withdrawal being correctly (or
incorrectly) declined: insufficient balance, account-limit reached,
ATM-limit reached, ATM out of cash, or "cannot make exact change"
(`withdraw()`, index.html:506-540, each path calls `logTransaction(amount,
false, reason)` and shows a generic `'Withdrawal denied.'`). The specific
reason is recorded in `state.transactions` (visible only in the debug
panel's history list) but never surfaced in the main-screen message — see
`properties/decline-reason-not-surfaced.md`.

## 9. External Dependencies and Integration Points

None. Zero network calls, zero third-party services, zero DOM libraries
(vanilla JS/CSS/HTML only, no CDN scripts).

## 10. Product Context

User-facing goal: let a tester explore a €X/day ATM withdrawal limit rule
interactively. Three panels: the always-visible balance screen, a toggle-able
DEBUG panel (limits, clock, cash inventory, transaction history — read/adjust
"withdrawn elsewhere"), and a toggle-able ADMIN panel (refill bills, change
both daily limits and balance, set/reset a simulated clock). The ADMIN and
Clock controls exist specifically so a human tester can construct the
boundary and oracle scenarios `README.md` lists (e.g., jump the clock across
midnight, lower a limit mid-day). A user-visible failure here is either (a)
the simulator gets the limit/cash-dispensing rule wrong, silently misleading
whoever is using it to learn requirements testing, or (b) the debug/admin
tooling itself is inconsistent, undermining the scenarios it exists to let
testers construct.

## 11. Unproven Assumptions

- **Greedy bill dispensing is assumed complete.** `dispenseBills()`
  (index.html:465-481) greedily takes the largest denomination first, bounded
  by availability, denomination-by-denomination, with no backtracking. This
  is a bounded (not unlimited-supply) change-making problem; greedy is not
  guaranteed to find an existing feasible combination. **Confirmed by direct
  trace**, not suspected: with `bills = {100:0, 50:2, 20:3, 10:0}` and
  `amount = 110`, a valid combination exists (1×€50 + 3×€20 = €110, well
  within available counts) but `dispenseBills(110, bills)` returns `null`
  because the greedy pass spends both €50 bills first, leaves a €10
  remainder, and has no €10 bills or €20-sized flexibility left to close it.
  The ATM would wrongly show "Withdrawal denied" for cash it physically has
  and a valid dispense plan exists for. See
  `properties/exact-change-completeness.md` — this is the single highest
  confidence, highest-value finding in this analysis.
- **`checkDayReset()` assumes time only moves forward.** It compares
  `state.resetDate` to `todayStr()` by string inequality, not by "did a real
  24h period elapse." Moving the simulated clock *backward* across a date
  boundary (via the admin Clock panel) changes `todayStr()` to an earlier
  calendar day, which is unequal to `resetDate`, and **resets the daily
  counters** exactly as if a real day had passed. Moving forward again
  resets them a second time. See
  `properties/clock-rewind-resets-counters.md`.
- **`applyAdmin()` never reconciles `withdrawnElsewhere` against a newly
  lowered account limit combined with `withdrawnToday`.** This session's
  prior fix (`setElsewhere()`, index.html:459-463, and the re-clamp added to
  `applyAdmin()`) bounds `withdrawnElsewhere` by `dailyLimit` alone, not by
  `dailyLimit - withdrawnToday`. The failure direction is safe (over-blocks
  rather than over-permits — see `properties/withdrawn-elsewhere-bounded.md`
  Open Questions) but it's an assumption worth stating explicitly since it
  wasn't verified against the stricter bound.
- **"Cannot happen" comment-style assumptions:** none found as comments —
  the code has no comments at all, which itself removes a normal source of
  claimed-invariant leads (nothing like "this should never be 0" to mine).

## 12. Wildcard

- The debug/admin panels are richer than the underlying model they expose.
  They let a tester manufacture states the *code* can reach (lower a limit
  mid-day, rewind the clock, hand-set "withdrawn elsewhere") but the
  README's requirements model describes states the code *cannot* reach at
  all — multiple accounts, multiple cards, a real second ATM, a network
  partition between ATM and bank host. The simulator is honest about testing
  the single-ATM/single-account slice of the model and nothing past it. Any
  property framed around "two ATMs race" or "account shared across cards"
  is out of scope for this SUT as written — not a gap in analysis, a gap in
  what exists to test. Recorded here so property discovery doesn't invent
  untestable properties against a system that doesn't model the concept.
- `dispenseBills()`'s incompleteness (Focus 11) and the fractional-amount
  truncation (Focus 4) are the same *shape* of bug: user-facing validation
  or allocation logic that looks right for the tested happy-path
  denominations/amounts in `README.md`'s own test list, but is wrong on
  inputs the author's own oracle-question list gestures at
  ("denomination and change interactions") without the author having
  actually traced the algorithm. That's a believable blind spot: a
  hand-written greedy allocator "feels" correct because it's correct on
  typical/round inputs.
- The ADMIN panel's inputs (`refill100`, `cfgAtmLimit`, etc.) have no upper
  bound at all (`Math.max(0, ...)` only) — you can set a bill count or a
  daily limit to `Number.MAX_SAFE_INTEGER`-ish values with no downstream
  clamping. Since this is intentionally an unrestricted test-configuration
  panel, this is almost certainly by design, not a defect — flagged for
  completeness, not proposed as a property.

## Assumptions

- "Antithesis" here is used in the generic sense of this skill's fault-injection
  methodology; there is no existing Antithesis SDK integration in this
  codebase (confirmed — see `existing-assertions.md`).
- Single-agent research mode was used given the SUT's size; if the file
  grows substantially, re-run with the ensemble mode described in
  `references/sut-discovery.md`.

## Open Questions

- None at the SUT-analysis level (file-level). Property-specific open
  questions are recorded per-property under `properties/{slug}.md` and
  summarized in `property-catalog.md`.
