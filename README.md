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
and default action generators in `bombadil/specification.ts`, and writes a
trace to `bombadil-output/`. It exits non-zero if a property violation is
found (`--exit-on-violation`).

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
no 4xx/5xx responses) and default action generators (clicks, input filling,
navigation, scrolling), plus custom properties specific to the ATM's business
rules:

- Account balance never goes negative.
- Cash counts per denomination, and total cash in the ATM, never go negative.
- "Remaining today" figures (account and ATM) never display as negative.
- The ATM never dispenses more than its own daily limit in a day.
- The account never withdraws more — across this ATM and the simulated
  "withdrawn at other ATMs" field — than its daily limit allows.
