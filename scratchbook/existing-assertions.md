---
sut_path: /Users/maaretp/Documents/cgi-code/atm
commit: a0effb700d2c2df88f5e8502923e039eb60c0e7e
updated: 2026-09-29
external_references: []
---

# Existing Antithesis Assertions

Searched `index.html` (the only source file) for imports of the Antithesis
SDK and calls to assertion functions (`assert_always!`, `assert_sometimes!`,
`assert_reachable!`, `assert_unreachable!`, non-macro equivalents, or any
`antithesis` identifier).

**None found.** The codebase has no Antithesis SDK dependency of any kind —
expected, since it's a dependency-free static HTML/JS file with no package
manager, no `<script src="...">` beyond the inline block, and no build
tooling to pull in an SDK. Confirmed with a full-text scan of `index.html`
for `antithesis` (case-insensitive): zero matches.

Every property in `property-catalog.md` therefore starts from zero
instrumentation — there is no "already exists / partially present" case to
track for this codebase, only "missing."
