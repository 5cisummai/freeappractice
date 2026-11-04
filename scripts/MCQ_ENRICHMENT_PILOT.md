# MCQ enrichment pilot

This tool reads the existing library and writes local, **unreviewed proposals**. It never updates questions. Running it calls the configured AI Gateway models and incurs usage; `--help` does not access the database or models.

```sh
bun --preload ./scripts/bun-sveltekit-env-preload.ts scripts/pilot-mcq-enrichment.ts --help
bun --preload ./scripts/bun-sveltekit-env-preload.ts scripts/pilot-mcq-enrichment.ts --course "AP Biology" --limit 80 --output-dir .tmp/mcq-enrichment-pilot --concurrency 2
```

Use existing `DATABASE_URL` and AI Gateway credentials. Both model defaults follow the application MCQ generation model. Override independently with `--classification-model MODEL` and `--explanation-model MODEL`.

Sampling is deterministic by question ID, stratified over course units. Complete stimulus groups may increase the requested sample size. Units with insufficient inventory contribute fewer questions; the report records the actual count. Diagram-dependent items are recorded as skipped.

`results.jsonl` is an append-only checkpoint log with one record after each completed step. The latest record for each question is authoritative. `report.md` summarizes final statuses. Results include source fingerprints, model and prompt/rubric version, proposals, review reasons, failures and successful-call token usage. Dollar costs are unavailable and are not estimated.

Add `--resume` to reuse successful, review-needed, or skipped steps only when the source fingerprint, model, and prompt version match. Failed steps retry up to three times. Without `--resume`, the results file is reset. Use separate output directories for concurrent runs.

Review both difficulty/subtopic classification and each choice explanation against a human-reviewed reference sample. Review-needed results are not approved metadata. A production write path and library-wide model selection are separate work.
