---
name: test-deduplication
description: Review this repository's unit tests for redundant or low-value checks and remove tests that cannot catch meaningful regressions.
---

# Test Deduplication

Use this skill when asked to review or clean up Free AP Practice tests, including tests that are redundant, vacuous, or otherwise provide no useful failure signal.

Inspect tests and nearby implementation to understand what each test proves. For every test, ask: if the relevant behavior regressed, would this assertion fail for a useful reason? Remove tests that only restate inputs, assert constants or mock setup without protecting a meaningful contract, check that imported values merely exist when real behavior is already covered, or otherwise pass without detecting a plausible regression. A test that executes code is not automatically useful.

Remove or combine overlapping tests when one stronger test preserves the distinct useful coverage. Keep tests for meaningful user-visible behavior, boundaries, failure handling, regressions, security properties, data integrity, or important integration contracts, even if they look small. Do not delete a test solely because it is short, tests a helper, uses mocks, or has a similar title. Strengthen a weak test only when a focused assertion can make it useful without broadening scope; otherwise remove it.

Keep changes limited to tests and this skill. Do not change application behavior or weaken useful assertions. Summarize tests removed or consolidated and the important coverage that remains. Follow repository instructions for verification; run only a focused relevant test command when requested or needed to confirm the cleanup.
