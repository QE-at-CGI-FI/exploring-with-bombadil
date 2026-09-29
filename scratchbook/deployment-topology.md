---
sut_path: /Users/maaretp/Documents/cgi-code/atm
commit: a0effb700d2c2df88f5e8502923e039eb60c0e7e
updated: 2026-09-29
external_references: []
---

# Deployment Topology — ATM Simulator

Written to satisfy `property-evaluation.md`'s prerequisites (the
Implementability lens needs a topology to check properties against). Not
produced as part of the requested "identify properties" work in depth —
kept intentionally minimal, matching the SUT.

## Topology

```text
+----------------------+      +----------------------+
| workload client      | ---> | SUT container         |
| (headless-browser or | <--- | (static file server   |
|  DOM-driving driver,  |      |  serving index.html)  |
|  Antithesis SDK)      |      +----------------------+
+----------------------+
```

One SUT container, one client container. No dependency containers — the
SUT has zero external services (`sut-analysis.md` Focus 9).

## Components

### SUT container

- **Image source:** new, minimal — any static file server (e.g. a
  one-line `python -m http.server` or `nginx`-serving-a-single-file image)
  pointed at `index.html`. No existing Dockerfile in the repo to reuse.
- **Role:** service (the entrypoint under test).
- **What it runs:** serves the single static `index.html` file (all logic
  is client-side JS embedded in that file — there is no separate backend
  process to isolate).
- **Network connections:** HTTP, to the workload client only.
- **Replica count:** 1. Nothing in this SUT (`sut-analysis.md` Focus 3, 7)
  involves concurrency or distributed coordination, so multiple replicas
  add state space with no corresponding property to exercise it.
- **Environment:** pin `TZ=UTC` (added during the evaluation pass, see
  `evaluation/implementability.md`). `todayStr()`'s day-boundary logic
  (index.html:445) has no explicit timezone handling, so leaving the host
  timezone unpinned makes `daily-counters-reset-at-day-boundary` and
  `clock-rewind-resets-counters` non-reproducible across different
  Antithesis infrastructure or across a DST transition. If DST-boundary
  behavior itself becomes a desired property later, vary the timezone
  deliberately for that specific run rather than leaving it to whatever
  the default happens to be.

### Workload client container

- **Role:** client.
- **What it runs:** a driver that loads `index.html` in a headless
  browser (or otherwise executes the page's JS in a DOM-capable
  environment — the code directly manipulates `document.getElementById`
  and browser `Date`, so a non-browser JS harness would need to stub the
  DOM) and drives the withdrawal/admin/debug controls documented in
  `sut-analysis.md` Focus 1 and 10: `#amountInput` + WITHDRAW button,
  the ADMIN panel's refill/limit/balance/clock inputs, and the DEBUG
  panel's "Withdrawn at other ATMs" input. Carries the Antithesis SDK to
  emit the assertions defined per-property in `property-catalog.md`.
  Also carries the reference/oracle logic needed for the two completeness
  properties (`exact-change-completeness`,
  `within-limit-withdrawal-not-spuriously-declined`) — an exhaustive
  bounded-knapsack check over `atm.bills` to compute whether a feasible
  combination exists, independent of `dispenseBills()`'s own (buggy)
  logic.
- **Network connections:** HTTP to the SUT container.
- **Replica count:** 1.

## Simplicity Notes

- No database/queue/cache dependency containers — none exist in the SUT.
- A second SUT replica (to literally instantiate README's "two ATMs"
  scenario) was considered and rejected: the code has no mechanism for two
  ATM instances to share or race over account state at all
  (`withdrawnElsewhere` is a manually-set number, not a live second
  instance — see `sut-analysis.md` Focus 12). Standing up a second
  container wouldn't exercise any additional code path; it would just be
  two independent, unconnected instances of the same page.
- The clock-manipulation properties (`daily-counters-reset-at-day-boundary`,
  `clock-rewind-resets-counters`) don't need container-level time-fault
  injection — the SUT already exposes its own simulated-clock control
  (`applyClock`/`resetClock`) as an in-page admin feature, so the workload
  drives that directly rather than needing Antithesis's system-level clock
  fault injection.

## Open Questions

- Does the intended Antithesis SDK support driving a real browser DOM
  (for `document.getElementById`-style interaction), or does the workload
  need a headless-browser wrapper (e.g. Puppeteer/Playwright) with the SDK
  called from the wrapper's process rather than from inside the page's own
  JS context? This determines the workload container's base image and
  isn't resolvable from the SUT's source alone. `(needs human input)`
