# clock-rewind-resets-counters

## Evidence Trail

README's own oracle question: "Client-side time manipulation — does moving
the clock forward trigger a reset?" The code's admin Clock panel
(`applyClock()`/`resetClock()`, index.html:673-686) is the tool that lets a
tester actually answer this question empirically — tracing it answers the
question precisely, and also reveals it's not limited to "forward."

## Relevant Code

```js
function checkDayReset() {
  if (state.resetDate !== todayStr()) {   // string inequality, not "time advanced"
    state.resetDate = todayStr();
    state.account.withdrawnToday = 0;
    state.account.withdrawnElsewhere = 0;
    state.atm.withdrawnToday = 0;
    ...
  }
}
function applyClock() {
  const val = document.getElementById('cfgClock').value;
  if (!val) return;
  const target = new Date(val).getTime();
  state.clockOffset = target - Date.now();
  checkDayReset();
  renderClock();
}
```

(index.html:448-457, 673-680.)

## Failure Scenario — Traced

1. Real day is 2026-09-29. Withdraw €200 at this ATM (`withdrawnToday =
   200`, against e.g. a €300 ATM limit — €100 remains).
2. Admin sets the simulated clock to 2026-09-28 (yesterday) via
   `applyClock()`. `todayStr()` now evaluates to `"Mon Sep 28 2026"`, which
   is `!== state.resetDate` (`"Tue Sep 29 2026"`) → `checkDayReset()` fires,
   zeroing `withdrawnToday` back to 0 and setting `resetDate` to the
   28th.
3. Admin sets the clock back to 2026-09-29 (or resets to real time via
   `resetClock()`, which sets `clockOffset = 0` and calls `renderClock()`
   — note `resetClock()` does **not** call `checkDayReset()` itself, but
   the 1-second `setInterval` will within a second). `todayStr()` now
   evaluates to the 29th again, `!== resetDate` (the 28th) →
   `checkDayReset()` fires **again**, zeroing counters a second time.
4. Net effect: the tester (or, in a non-debug build, anyone able to reach
   this control) can now withdraw the full €300 ATM limit again on the
   *same real calendar day*, purely by rewinding and restoring the clock —
   no real 24 hours elapsed.

## Why It Matters, With the Scope Caveat

This directly demonstrates the mechanism behind README's oracle question,
which is valuable — the Clock panel exists specifically so a tester can
explore exactly this kind of boundary scenario, and correctly reproducing
"yes, clock manipulation causes a reset" is arguably the tool *working as
intended* for a teaching exercise about limit ambiguity. Whether this
should instead be *guarded against* (e.g., only allow the reset when the
simulated time moves strictly forward past a boundary, never backward) is
a product decision — see Open Questions.

## Investigation Log

### Is clock-rewind-causes-reset the intended behavior of the debug tool, or should it be guarded?

- Examined: every call site of `checkDayReset()` (index.html:488, 678,
  712) and `applyClock()`/`resetClock()` (index.html:673-686); the ADMIN
  panel's HTML labeling ("Clock" section, "SET CLOCK" / "RESET TO REAL",
  index.html:314-324); `README.md`'s oracle-question framing of clock
  manipulation (lines 142, 183).
- Found: the admin Clock panel is explicitly framed in the UI and in
  README as a tool for a human tester to *construct* day-boundary
  scenarios ("what happens at exactly midnight") — its entire purpose is
  letting the operator move time arbitrarily, including backward, to set
  up a specific test. Nothing in the code or docs suggests it's meant to
  simulate only forward-moving time.
- Not found: no statement anywhere (code comment, README, ideas.md) about
  whether a *non-debug*, customer-facing path could ever reach this same
  mechanism — there isn't one in this SUT (the Clock panel is the only way
  `state.clockOffset` changes), so the "attacker changes clock" framing
  from README's security-and-abuse oracle question doesn't actually apply
  to this specific client-side simulator's threat model as built.
- Conclusion: tagged `(needs human input)` — the mechanism is fully
  understood and reproducible, but whether it should be classified as a
  defect to fix (guard against rewind) or documented as intentional
  debug-tool behavior is a call for whoever owns the teaching exercise,
  not something further tracing resolves.
