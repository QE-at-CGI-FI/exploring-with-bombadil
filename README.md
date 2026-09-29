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
scrolling), plus custom properties specific to the ATM's business rules:

- Account balance never goes negative.
- Cash counts per denomination, and total cash in the ATM, never go negative.
- "Remaining today" figures (account and ATM) never display as negative.
- The ATM never dispenses more than its own daily limit in a day.
- The account never withdraws more — across this ATM and the simulated
  "withdrawn at other ATMs" field — than its daily limit allows.

### Numeric input actions

Bombadil's default `inputs` action generator types generic filler text into
editable elements, without regard for `type="number"` fields — against this
app, it never actually inserted numbers, so the withdrawal amount and daily
limit logic (the whole point of the app) was never really exercised. The
spec adds its own action generators instead:

- `withdrawAmountEntry` sets the withdrawal amount field directly to values
  chosen to sit on the boundaries of the app's rules: zero, a non-multiple
  of 10, a negative number, and values exactly at / one step past the
  account limit, the ATM limit, and the account balance.
- `elsewhereEntry` sets the "withdrawn at other ATMs" debug field to values
  at and beyond the account's daily limit.
- `adminFieldEntry` sets the admin panel's numeric fields (cash refill
  counts, daily limits, balance) once the panel is open.
- `randomDigitEntry` types freeform random digit strings into whatever
  currently has focus, for broader fuzzing beyond the curated values above.

### Known finding

With numbers actually going into the fields, `accountWithdrawalsRespectAccountLimit`
now fails almost immediately: the "Withdrawn at other ATMs" debug input has
no upper bound (no HTML `max`, and the app only clamps it to `>= 0`), so
typing a value like `510` into that one field alone exceeds the account's
€500 daily limit — no actual over-limit withdrawal at this ATM is required.
This is a real, easily reproducible gap in the app's input validation, kept
as a strict property on purpose: it's exactly the kind of edge case
property-based testing is meant to surface. Because of it, `npm test`
should be read as a bug tracker check rather than a green CI gate right
now — run `npm run test:inspect` after `npm test` to see it on the
timeline.
