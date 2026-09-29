---
sut_path: /Users/maaretp/Documents/cgi-code/atm
commit: a0effb700d2c2df88f5e8502923e039eb60c0e7e
updated: 2026-09-29
external_references: []
---

# Evaluation: Wildcard

One-line summaries of the other three lenses for reference: Lens 1
(Antithesis Fit) — sweet-spot vs. unit-test-territory; Lens 2 (Coverage
Balance) — portfolio gaps and assertion-type balance; Lens 3
(Implementability) — observability and feasibility given the topology.

## Findings

### catalog-wide — three properties describe *currently-failing* invariants, mixed in among properties that currently hold

- **Property/Properties:** `exact-change-completeness`,
  `clock-rewind-resets-counters`, `fractional-amount-truncated-not-rejected`
  (and, downstream, `within-limit-withdrawal-not-spuriously-declined`,
  `decline-reason-not-surfaced`)
- **Concern:** This doesn't fit neatly under Antithesis Fit (it's not about
  search-space shape), Coverage Balance (it's not a gap), or
  Implementability (all three are fully implementable) — it's a framing
  question about what a "property catalog" is for. A first Antithesis run
  against this catalog, if the code isn't fixed first, will report several
  "violations" that are already known from static tracing, not newly
  discovered. That has real value (validates the workload/oracle logic is
  correctly wired — a known bug it fails to catch means the harness is
  broken) but it's a different value proposition than the rest of the
  catalog, and nothing in the catalog currently marks that distinction for
  whoever runs it first.
- **Scope:** Catalog-wide framing question.
- **Evidence:** `property-catalog.md`'s own "CONFIRMED VIOLATED" tags on 3
  of 17 entries — added deliberately during discovery per
  `references/validating-claims.md`'s discipline (don't state a guarantee
  holds when it doesn't), but not otherwise called out at the catalog
  level as a distinct set.
- **Suggested action:** Recommend, not applying automatically: add one
  sentence at the top of `property-catalog.md` (already partially done —
  the catalog's opening paragraph names both defects) directing whoever
  runs this first to treat those 3 as "expected to fail on first run,
  useful for validating the harness itself" rather than being surprised by
  immediate failures. Left as a suggestion rather than an applied edit
  since it borders on workload-execution guidance, outside this research
  pass's scope.

### bias — is a full Antithesis deployment proportionate for a 720-line teaching artifact?

- **Property/Properties:** catalog-wide
- **Concern:** This is a genuine values question the other three lenses
  can't resolve, so flagging as a **Bias** for the human rather than
  something to fix in the catalog. The SUT is explicitly a teaching demo
  (`README.md`: "A test target for a requirements exercise for teaching
  testing") with no production stakes. Standing up containers, an SDK
  integration, and a fault-injection harness for it is either (a)
  disproportionate tooling for a demo whose bugs are more efficiently
  fixed by just reading `dispenseBills()` carefully (as this research pass
  did, by hand, in a few minutes), or (b) exactly the point — using
  Antithesis itself as a second teaching example, showing students what
  property-based fault injection finds that manual review might miss. The
  catalog and topology were built as if (b) is true; nothing in the
  request or the repository confirms that's the actual goal.
- **Scope:** Catalog-wide / project-level, not fixable by editing the
  catalog.
- **Evidence:** `README.md`'s framing as a teaching artifact; the
  `exact-change-completeness` bug was found by direct code trace in this
  same research pass, without running anything.
- **Suggested action:** Present to the user — see chat response. This
  research pass proceeds on the assumption that identifying properties is
  useful regardless of whether a full Antithesis run ever happens (the
  catalog and evidence files are valuable as a structured, traced defect
  list either way), so no catalog change is being made in response to this
  finding — it's a heads-up, not a blocker.

### cross-cutting — the "confirmed defect" properties and the "admin/debug tooling" properties share a common origin: hand-written code with zero comments and zero existing tests

- **Property/Properties:** `exact-change-completeness`,
  `fractional-amount-truncated-not-rejected`, `clock-rewind-resets-counters`,
  `withdrawn-elsewhere-bounded`
- **Concern:** All four of the catalog's "interesting" findings (confirmed
  defects or precision gaps) trace back to the same root cause pattern:
  code with no comments, no tests, and no design doc beyond README's
  higher-level model — meaning nothing in the codebase itself ever forced
  the author to state an assumption explicitly (e.g., "greedy dispensing is
  assumed complete," "clock only moves forward") where it could be checked.
  This is a comment on *why* this SUT is unusually rich in traceable
  defects for its size, not a new property.
- **Scope:** Catalog-wide observation, informational.
- **Evidence:** `git log` shows no test files ever existed
  (`existing-assertions.md`); `sut-analysis.md` Focus 6 and 11.
- **Suggested action:** None — informational, already reflected in how
  `sut-analysis.md` Focus 11 and 12 are written.

## Passes

- No missing failure-scenario class found beyond what Coverage Balance
  already surfaced (decline-reason and denomination-exhaustion exploration
  hints).
- No property in the catalog was found to rest on a false premise about
  what the SUT can do (the single-ATM-instance limitation was already
  self-corrected during discovery, per `sut-analysis.md` Focus 12 and
  `deployment-topology.md`'s rejection of a second SUT replica).

## Uncertainties

- Whether the "3 known-failing properties" framing point should be a
  stronger, applied edit (e.g., a `status: known-defect` field per
  property) versus the lighter touch applied here (one directive sentence)
  is a workload/reporting-format design choice better made by whoever
  actually wires up the Antithesis run, not by this research pass.
