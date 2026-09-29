# exploring-with-bombadil

Bombadil is a webUI model- and property-based testing tool: https://antithesishq.github.io/bombadil/index.html

This repo uses Bombadil to test the [ATM Simulator](https://qe-at-cgi-fi.github.io/atm/), a
single-page app for withdrawing cash against an account balance, daily
account/ATM limits, and a limited supply of banknotes.

## Setup

```bash
npm install
```

## Running the test

```bash
npm test
```

This runs Bombadil against the live app for one minute, using the properties
and action generators in `bombadil/specification.ts`, and writes a trace to
`bombadil-output/`. It exits non-zero if a property violation is found
(`--exit-on-violation`).

**Note:** this currently exits almost immediately with a real finding — see
[Known finding](#known-finding) below.

To explore for longer, run Bombadil directly, e.g.:

```bash
npx bombadil browser test --time-limit=10m --exit-on-violation \
  --output-path=bombadil-output --output-path-overwrite \
  https://qe-at-cgi-fi.github.io/atm/ bombadil/specification.ts
```

## Inspecting results

```bash
npm run test:inspect
```

Opens the Bombadil Inspect UI against the last trace in `bombadil-output/`,
letting you step through state transitions and see any violations on the
timeline.

## Reproducing a violation

If a run finds a violation, reproduce the same sequence of actions with:

```bash
npx bombadil browser test --reproduce=bombadil-output \
  https://qe-at-cgi-fi.github.io/atm/ bombadil/specification.ts
```

## What's being checked

`bombadil/specification.ts` re-exports Bombadil's default browser properties
(no uncaught exceptions, no unhandled promise rejections, no console errors,
no 4xx/5xx responses) and default action generators (clicks, navigation,
scrolling), plus custom properties specific to the ATM's business rules.

The custom properties were grounded in a systematic property-discovery pass
over the SUT (see `scratchbook/property-catalog.md` in this repo, 19
properties across 8 categories); each property below names the catalog slug
it implements, so the two can be cross-checked:

- Account balance never goes negative (`balance-never-negative`).
- Cash counts per denomination, and total cash in the ATM, never go negative
  (`bill-inventory-never-negative`).
- "Remaining today" figures (account and ATM) never display as negative.
- The ATM never dispenses more than its own daily limit in a day
  (`atm-daily-limit-never-exceeded`).
- The account never withdraws more — across this ATM and the simulated
  "withdrawn at other ATMs" field — than its daily limit allows
  (`account-daily-limit-never-exceeded`).
- A declined withdrawal never mutates balance, either withdrawn-today
  counter, or the bill inventory (`declined-withdrawals-dont-consume-limit`).
- Cash removed from the ATM on a successful withdrawal always equals exactly
  the requested amount (`dispensed-amount-matches-requested`).
- If some combination of available bills can make exact change, the ATM
  must find it (`exact-change-completeness`), checked against an
  independent bounded reference oracle, not the app's own greedy allocator.
- Any withdrawal within both limits, within balance, and cash-feasible must
  succeed (`within-limit-withdrawal-not-spuriously-declined`).
- Lowering the account limit mid-day below what's already been withdrawn
  blocks all further withdrawals until reset
  (`admin-limit-reduction-blocks-overdrawn-account`).
- "Withdrawn at other ATMs" never exceeds the account's own daily limit
  (`withdrawn-elsewhere-bounded`).
- A successful withdrawal is always a positive multiple of €10
  (`withdrawal-amount-positive-multiple-of-ten`).
- A fractional amount (e.g. "300.50") must be rejected, not silently
  truncated by `parseInt` (`fractional-amount-truncated-not-rejected`).
- A decline message always stays generic and never reveals which specific
  gate failed — the catalog's initial pass treated this the other way
  around (README wanted the specific reason surfaced), but leaking that
  detail makes it easier to probe account/ATM state, so this was inverted
  on review (`decline-reason-not-surfaced`, corrected).
- A page reload always returns to the hardcoded defaults
  (`no-state-persistence-across-reload`).
- Exploration guidance nudging Antithesis toward hitting all five decline
  reasons (`atm-decline-reasons-explored`) and toward exhausting a bill
  denomination (`atm-denomination-exhausted`) at least once per run.
- The daily counters reset when the simulated clock's calendar date changes
  (`daily-counters-reset-at-day-boundary`), and — as a documented,
  intentionally non-blocking reachability marker rather than a hard failure
  — rewinding the simulated clock across a day boundary is confirmed to
  trigger that same reset even though no real day has passed
  (`clock-rewind-resets-counters`).

Not implemented: `transaction-history-bounded-growth` — the evaluation pass
in `scratchbook/evaluation/implementability.md` found it impractical within
normal Antithesis timeline limits.

### Numeric input actions

Bombadil's default `inputs` action generator types generic filler text into
editable elements, without regard for `type="number"` fields — against this
app, it never actually inserted numbers, so the withdrawal amount and daily
limit logic (the whole point of the app) was never really exercised. The
spec adds its own action generators instead:

- `withdrawAmountEntry` sets the withdrawal amount field directly to values
  chosen to sit on the boundaries of the app's rules: zero, a non-multiple
  of 10, a negative number, two fractional amounts, and values exactly at /
  one step past the account limit, the ATM limit, and the account balance.
- `elsewhereEntry` sets the "withdrawn at other ATMs" debug field to values
  at and beyond the account's daily limit.
- `adminFieldEntry` sets the admin panel's numeric fields (cash refill
  counts, daily limits, balance) once the panel is open.
- `clockEntry` sets the admin panel's simulated-clock field, when open, to a
  fixed far-past and far-future datetime, to drive day-boundary crossings in
  both directions.
- `randomDigitEntry` types freeform random digit strings into whatever
  currently has focus, for broader fuzzing beyond the curated values above.

### Known findings

With numbers actually going into the fields, several properties fail
almost immediately — this is a bug tracker check, not a green CI gate.
Because `npm test` uses `--exit-on-violation`, it stops at whichever
violation is found first, which depends on random exploration order. Run
without `--exit-on-violation` (see [Running the test](#running-the-test))
to see further findings in one run, then `npm run test:inspect` to step
through them on the timeline. Confirmed findings include:

- `exactChangeCompleteness` — the greedy bill allocator can decline a
  withdrawal for cash it physically has (e.g. `bills = {100:0, 50:2, 20:3,
  10:0}`, `amount = 110`: 1×€50+3×€20=€110 is feasible but greedy fails to
  find it), confirmed against an independent reference oracle.
- `fractionalAmountRejectedNotTruncated` — `parseInt("300.5", 10) === 300`
  lets a fractional amount silently through as a valid integer withdrawal.

`accountWithdrawalsRespectAccountLimit` no longer fails via the single-field
route an earlier version of this README described (typing a large value
straight into "Withdrawn at other ATMs"): `setElsewhere()` in the current
SUT already clamps that field to `dailyLimit`, per a fix noted in
`scratchbook/property-catalog.md`'s `withdrawn-elsewhere-bounded` entry. By
source trace, the property is still reachable via a two-step scenario that
fix doesn't close — withdraw enough at this ATM first, then set "elsewhere"
up to the (still-unreduced) daily limit, so `withdrawnToday +
withdrawnElsewhere` exceeds `dailyLimit` — but this hasn't been directly
observed in a run yet, unlike the two findings above.

Long, `--exit-on-violation`-free runs (40s+) have occasionally hit a
`Debugger.evaluateOnCallFrame` timeout from the browser driver itself,
independent of which properties are violated — this reproduced even with
`--instrument-javascript=` (coverage instrumentation off) and with the
machine otherwise idle, so it looks like Chrome DevTools Protocol flakiness
under a long-lived automated session rather than a defect in the
specification. `npm test`'s default `--exit-on-violation` means this is
unlikely to matter in normal use, since a real violation is usually found
well before a run gets that long.
