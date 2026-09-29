---
sut_path: /Users/maaretp/Documents/cgi-code/atm
commit: a0effb700d2c2df88f5e8502923e039eb60c0e7e
updated: 2026-09-29
external_references: []
---

# Evaluation: Coverage Balance

## Findings

### catalog-wide — assertion type portfolio is heavily skewed toward `Always`, with almost no exploration-guidance assertions

- **Property/Properties:** catalog-wide
- **Concern:** Of 17 properties, ~14 are `Always`, 1 is `Sometimes`, ~2 are
  `Reachable`-leaning, 0 are `AlwaysOrUnreachable`. `property-evaluation.md`
  names this exact pattern as a red flag: "A catalog with 15 `Always`
  assertions and no `Sometimes` assertions is probably missing liveness
  properties" — and separately, a catalog with no `Reachable` assertions
  "may not be guiding Antithesis toward interesting code paths." This
  catalog is short on both. Concretely: nothing currently tells Antithesis
  "it's interesting when the ATM runs a specific denomination down to
  zero" or "it's interesting when each of the five decline reasons has
  been exercised" — exactly the states that make `exact-change-completeness`
  counterexamples more likely to surface.
- **Scope:** Catalog-wide (composition of the set, not any one property).
- **Evidence:** Tally against `property-catalog.md` as written.
- **Suggested action:** **Gap.** Add 2 `Reachable`/`Sometimes` properties
  that give Antithesis explicit exploration hints toward the states most
  likely to trigger the dispensing-completeness bug class: (1) all five
  decline reasons observed at least once in a run, (2) at least one bill
  denomination observed exhausted (count reaches 0) during a run. See
  "Gap-Fill Properties" below — applied directly to the catalog as part of
  this evaluation pass (small expansion, 2 properties, no second
  evaluation pass needed per `references/property-evaluation.md`).

### no gap found — cash-dispensing risk area has proportionate coverage

- **Property/Properties:** Dispensing Correctness cluster (4 properties)
- **Concern:** None. `sut-analysis.md` Focus 11 flags `dispenseBills()` as
  the highest-confidence unproven assumption in the SUT, and the catalog
  responds with 4 properties covering it from every angle (amount
  correctness, inventory non-negativity, completeness twice at different
  granularities). Proportionate, not over- or under-invested.
- **Scope:** N/A (pass).
- **Evidence:** `sut-analysis.md` Focus 11 vs. Dispensing Correctness
  cluster in `property-catalog.md`.

### no properties target the ADMIN panel's unbounded numeric inputs

- **Property/Properties:** none exist for this area
- **Concern:** `sut-analysis.md` Focus 12 (Wildcard) notes the ADMIN
  panel's refill/limit inputs have no upper bound at all (`Math.max(0,
  ...)` only) and calls this "almost certainly by design, not a defect" —
  but that conclusion isn't independently checked by any property, it's
  asserted once in the SUT analysis and never revisited.
- **Scope:** Potential gap, low confidence.
- **Evidence:** `applyAdmin()`, index.html:693-703.
- **Suggested action:** Not converting to a full property — the
  SUT-analysis conclusion is well-reasoned (this is explicitly an
  unrestricted test-configuration surface, not a customer-facing input) and
  overloading the catalog with a property whose answer is already "yes,
  and that's fine" doesn't add value. Recorded here instead as a
  documented, consciously-accepted gap rather than a silent one.

### component distribution is appropriate for a single-component SUT

- **Property/Properties:** catalog-wide
- **Concern:** None. `deployment-topology.md` has exactly one SUT
  component (the static page); there's no multi-service topology for
  properties to be unevenly distributed across. "Component blind spots"
  doesn't apply to a single-container SUT.
- **Scope:** N/A (pass).

## Passes

- Limit-enforcement risk area (README's core requirement): 4 properties,
  proportionate.
- Dispensing-correctness risk area: 4 properties, proportionate, correctly
  weighted toward the confirmed-defect mechanism.
- Day-boundary risk area (README's largest single oracle-question cluster):
  2 properties, proportionate given the SUT only implements one of the
  several "day" interpretations README considers.
- No over-investment found in any single area.

## Gap-Fill Properties

Per `references/property-evaluation.md` "Addressing Findings" #2, adding 2
properties directly (small expansion, same category additions, no second
evaluation pass warranted):

### atm-decline-reasons-explored — All Five Decline Reasons Are Observed At Least Once

| | |
|---|---|
| **Type** | Reachability |
| **Property** | Over the course of a run, each of the five decline branches in `withdraw()` (insufficient balance, account limit reached, ATM limit reached, ATM out of cash, cannot make exact change) is reached at least once. |
| **Invariant** | `Reachable`, one instance per branch, using the distinct `detail` strings already computed at each site (index.html:507, 514, 521, 528, 536) as the discriminating outcome — matches `property-catalog.md`'s guidance to prefer meaningful outcomes over broad path-entry markers. |
| **Antithesis Angle** | Pure exploration guidance — doesn't verify correctness by itself, but tells Antithesis's search that visiting all five decline reasons (not just the easy-to-reach "insufficient balance" case) is a goal worth prioritizing, which in turn increases the chance of surfacing `exact-change-completeness`-class bugs (reached via the fifth branch specifically). |
| **Why It Matters** | Without this, nothing signals to Antithesis that the "cannot make exact change" branch — the one with a confirmed defect behind it — is an interesting state to reach, versus the much-easier-to-hit "insufficient balance" branch dominating the search. |

**Open Questions:** None.

### atm-denomination-exhausted — At Least One Bill Denomination Reaches Zero During a Run

| | |
|---|---|
| **Type** | Liveness |
| **Property** | Over the course of a run, `state.atm.bills[d]` reaches exactly 0 for at least one denomination `d` while other denominations remain available. |
| **Invariant** | `Sometimes(cond)` where `cond` = "some `bills[d] === 0` while `Σ bills[d'] for d' != d > 0`" — a meaningful semantic state (partial exhaustion), not a trivial always-true condition, so `Sometimes` (not `Reachable`) is the right fit per `property-catalog.md`'s guidance. |
| **Antithesis Angle** | This is the precondition that makes `exact-change-completeness` counterexamples possible — the confirmed bug required exactly this shape of state (`{100:0, 50:2, 20:3, 10:0}`, two denominations exhausted). Explicitly hinting Antithesis toward partial-exhaustion states increases the odds of finding further counterexamples beyond the one hand-constructed one. |
| **Why It Matters** | Directly targets the highest-value confirmed-defect area in the catalog; without this hint, a workload that always refills the ATM to comfortable levels between withdrawal sequences would rarely construct the lopsided inventory states where the greedy allocator fails. |

**Open Questions:** None.

## Uncertainties

- Whether 2 added properties is enough to correct the `Always`-heavy
  imbalance, or whether more exploration-guidance properties should be
  added per cluster (e.g., one per decline branch individually rather than
  one combined property) is a workload-design refinement better made once
  the workload itself is being built, not from the catalog alone.
