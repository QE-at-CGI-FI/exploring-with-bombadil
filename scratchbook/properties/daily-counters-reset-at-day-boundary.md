# daily-counters-reset-at-day-boundary

## Evidence Trail

README's own oracle question, presented as unresolved by the requirement:
"Is 'day' a calendar day (midnight reset) or a rolling 24-hour window from
first transaction? Whose clock determines the day: the ATM's local time,
the bank server's time, or the customer's home branch time zone?" The code
gives a concrete, checkable answer to this question — this property exists
to verify the code actually behaves the way that answer implies.

## Relevant Code

```js
function now() {
  return new Date(Date.now() + (typeof state !== 'undefined' ? state.clockOffset : 0));
}
function todayStr() {
  return now().toDateString();
}
function checkDayReset() {
  if (state.resetDate !== todayStr()) {
    state.resetDate = todayStr();
    state.account.withdrawnToday = 0;
    state.account.withdrawnElsewhere = 0;
    state.atm.withdrawnToday = 0;
    const el = document.getElementById('inputElsewhere');
    if (el) el.value = 0;
  }
}
```

(index.html:440-457.)

Called from three places: top of `withdraw()` (index.html:488), the
1-second `setInterval` (index.html:711-714), and `applyClock()`
(index.html:678).

## Answer to README's Oracle Question

- **Scope of "daily":** calendar day, via `Date#toDateString()` — not a
  rolling 24-hour window.
- **Clock authority:** the ATM's own clock (`now()`), either real
  (`Date.now()`) or admin-simulated (`+ state.clockOffset`) — there's no
  concept of "bank server time" or "customer's home branch timezone" since
  there's no server or multi-branch model at all.
- **Timezone:** whatever the executing browser/OS reports (`toDateString()`
  uses local time implicitly).

## Failure Scenario

The reset only fires on the *next call* to `checkDayReset()` after the
boundary — bounded by at most ~1 second of staleness during idle time (the
`setInterval` cadence), or immediately on the next `withdraw()`/`applyClock()`
call. A withdrawal attempted in that up-to-1-second window right after a
real midnight crossing, before the interval tick fires, would still see
pre-reset counters — worth confirming this window is truly bounded and
doesn't ever fail to close (e.g., if the tab is backgrounded and browsers
throttle `setInterval`, the staleness window could be much larger than 1
second; the *next* `withdraw()` call still self-corrects since it calls
`checkDayReset()` first, so no unsafe state should persist past that).

## Key Observations

This property only concerns the *liveness* side (reset eventually happens).
The *safety* side — nothing between now and the reset incorrectly bypasses
the (still-active, not-yet-reset) prior day's limit — is already covered by
`atm-daily-limit-never-exceeded` and `account-daily-limit-never-exceeded`.

## Investigation Log

### Does DST or the execution environment's timezone affect the boundary in a way that needs to be pinned down before this property is implementable?

- Examined: `toDateString()` MDN semantics (uses the `Date` object's local
  time representation, which is derived from the JS engine's configured
  timezone — typically the host OS/browser timezone, or `TZ` in a Node-like
  environment); `now()` and `checkDayReset()` (index.html:440-457) for any
  explicit timezone handling — found none, confirming the implementation
  is fully at the mercy of the execution environment's timezone setting.
- Found: no explicit timezone pinning anywhere in `index.html`. Whatever
  environment runs this page (a real browser, or a headless environment
  under Antithesis) determines what "midnight" means for this property.
- Not found: no code or doc indicating an intended target timezone — the
  requirement (README) explicitly leaves this open ("whose clock") and the
  code resolves it by default/omission (host environment's local time)
  rather than by an explicit decision.
- Conclusion: tagged `(needs human input)` on the catalog entry — this
  isn't something further code tracing can resolve; it needs a decision on
  whether the Antithesis deployment should pin a specific timezone (and
  DST-affected date) to get deterministic, repeatable boundary tests, or
  deliberately vary it to exercise the ambiguity README itself flags.
