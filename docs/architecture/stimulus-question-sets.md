# Stimulus Questions and Sets

Status: Draft

This document records product and architecture decisions for adding text, diagram, and mixed stimuli to MCQs while preserving existing standalone questions.

## Confirmed decisions

### Unlimited practice serves child questions independently

In ordinary unlimited practice, a question that belongs to a multi-question stimulus set behaves as an independently served question.

- Selecting one child does not start a set session.
- The student is not required to answer the other children.
- Normal per-question checking and explanations remain available.
- Each child retains its own question ID, attempts, progress, bookmarks, and feedback.
- Unlimited practice keeps its existing question-level selection and exclusion behavior.
- No set-level exclusion, sibling sequencing, or special session state is added. A sibling may appear later through normal random selection.

### Quizzes fill remaining capacity from a selected set

When quiz or practice-test assembly selects a multi-question stimulus set, it adds child questions consecutively until either the set is exhausted or the requested quiz length is reached.

- The requested quiz question count remains exact.
- A set may be truncated when fewer quiz slots remain than the set contains.
- Example: if a 10-question quiz already contains eight questions, selecting a four-question set adds two children and stops at 10.
- The quiz does not grow beyond the requested count merely to finish a stimulus set.
- The randomly selected child is the starting position within its set.
- Assembly continues through later set positions and wraps to the first position when it reaches the end.
- No child is repeated during that traversal. Assembly stops when every child has been included or the quiz reaches capacity.

### Shared stimulus state persists across quiz siblings

When consecutive quiz questions reference the same stimulus, the stimulus pane preserves its state as the active child changes.

- Preserve stimulus scroll position.
- Preserve stimulus text annotations and highlights.
- Key shared stimulus state by stimulus ID.
- Keep answer selections, option elimination, flags, timing, and question-specific annotations keyed by question ID.
- Existing diagram rendering behavior is preserved when a diagram is part of the shared stimulus.
- Version one does not add freehand drawing or diagram-annotation tools.
- A truncated set does not display empty placeholders or imply that omitted siblings belong to the current quiz.

### Stimulus composition is catalog-driven

The kinds and composition of stimuli vary by AP course and must be governed by the unified AP catalog rather than hardcoded globally in generation or presentation logic.

- The storage and rendering model must be capable of representing the supported stimulus forms.
- Course and unit generation policy determines which forms may actually be generated.
- The global feature flag enables the capability but does not define curriculum eligibility.
- Course policy provides defaults, and units may override only the values that materially differ.
- A missing unit override inherits the course policy. An explicit unit-level `enabled: false` disables new stimulus generation for that unit.
- All children generated in one set belong to the same app course and unit in version one. Cross-unit sets are out of scope.
- Catalog policy governs new generation, not resolution of existing questions.

The minimum policy surface is:

- `enabled`
- allowed modes: text, diagram, and/or mixed
- whether multi-question sets are enabled
- minimum, target, and maximum children per set
- allowed semantic diagram families
- generation and review restrictions
- a target stimulus-question frequency when the course has a defensible value

The exact course and unit policy matrix is intentionally deferred to research. It must be derived from the unified AP catalog and authoritative course/exam guidance before implementation is considered complete.

The initial implementation scope is the five launch courses selected for this pilot: AP Biology, AP Chemistry, AP Physics 1, AP Human Geography, and AP World History. Each entry distinguishes official facts from app-authored conservative defaults and explicitly records unsupported forms. Additional catalog courses remain fail-closed until their own review is completed.

- Policy coverage and rollout enablement are separate concerns.
- All course policies default to disabled at launch-planning time.
- Only a small initial group will be enabled, but that group is intentionally undecided until the completed policy matrix is reviewed.
- Enabling the global feature flag does not override a disabled course or unit policy.
- No course silently falls back to generic stimulus generation when its policy is missing or invalid.

### Version-one stimulus content is deliberately fixed

The first-release stimulus contains a nullable text value and a nullable semantic `DiagramSpec`. At least one must be present.

- Text-only, diagram-only, and mixed stimuli use the same shape.
- A text value may contain labeled sections such as `Source A` and `Source B`; version one does not need a generic attachment or ordered-block system.
- All generated stimuli carry provenance identifying them as original AI-generated practice material.
- Audio, video, arbitrary images, photographs, artwork, externally sourced documents, and independently attributed attachments are unsupported in version one.
- Generated passages must not fabricate authentic quotations, authors, dates, publications, or historical-document attribution.
- A later sourced-content authoring/import pipeline may introduce ordered blocks and richer media without changing the child-question identity model.

The supporting source review and course matrix are recorded in `docs/research/ap-stimulus-question-source-research.md`.

### Initial authoring scope is AI generation only

The first release creates original stimuli through the existing AI question-generation pipeline.

- Imported passages, external images, externally sourced datasets, and user-authored stimulus ingestion are out of scope.
- A general custom authoring/import pipeline may be designed later, potentially months after this release.
- The initial model should not add speculative import workflows or source-management interfaces.

### The unified flag gates pool selection

When the unified stimulus/diagram feature flag is off, random question selection excludes stimulus-backed questions already stored in the pool. The flag therefore controls both generation eligibility and ordinary pool serving, unlike the existing diagram flag's generation-only behavior.

- Use one Vercel flag named `stimulus-questions`, defaulting to off, and retire the narrower `examfig-diagrams` flag as part of the implementation.
- The flag prevents new stimulus generation.
- The same flag controls original diagrams, text stimuli, and mixed stimuli; there is no second diagram flag.
- The flag excludes stimulus-backed questions from new random pool selection.
- Pool eligibility treats legacy top-level diagram questions as stimulus-backed for flag purposes.
- Existing references continue rendering through history, bookmarks, shared quizzes, question-by-ID links, and already assembled quizzes.
- The flag must not hide content or break a persisted user experience.
- General rule: gate preventable future selection and creation, never the ability to resolve existing references.
- Evaluate the flag at generation and random-selection boundaries, then pass the resolved capability into deeper modules. Repository helpers that resolve explicit IDs do not evaluate it.

### Version one embeds the stimulus in each child JSONB payload

Duplicating the same immutable stimulus content in every child question is acceptable for the first release.

- No separate canonical stimulus table is required for version one.
- Existing MCQ rows remain unchanged and continue to have no stimulus fields.
- Stimulus fields are added only to new JSONB payloads.
- The generated set must write identical stimulus content and metadata to every child.
- Every child in a set stores the same server-generated `stimulusId`, an explicit zero-based `stimulusPosition`, and `stimulusQuestionCount`.
- Grouping and order are never inferred by comparing duplicated stimulus JSON.
- The backend assigns set identity and final child order after validating the model's generated output.
- A later custom authoring or import pipeline may normalize stimuli into their own table if editing, external sourcing, or stronger relational integrity makes that worthwhile.

### Quality failures follow their scope

A failure in shared stimulus content makes every child with that `stimulusId` ineligible. A failure isolated to one child question makes only that child ineligible.

- Shared-stimulus validation covers text, diagram data, shared attribution metadata, and whether the stimulus is usable as a whole.
- Child validation covers the stem, options, answer, explanation, and its relationship to the shared stimulus.
- Quiz assembly may use the remaining eligible siblings when one child is excluded.
- Original `stimulusPosition` and `stimulusQuestionCount` metadata remain stable even when an ineligible child is skipped.

### Backend integrity defaults

- Persist all children produced by one stimulus-set generation in a single database transaction. A partial write is not accepted.
- Generate `stimulusId`, child question IDs, and final positions on the server after structured-output validation.
- A stimulus with one child is valid and uses the same representation as a multi-question set.
- Existing payloads without stimulus fields continue parsing and behaving exactly as discrete questions.
- New stimulus fields are additive; their absence must not trigger a migration, rewrite, or behavioral change for existing rows.
- Question identity and lifecycle remain child-level. The stimulus ID supplies grouping only and never replaces the question ID.

### Generation uses two strict schemas

The existing discrete-question structured-output schema remains unchanged. Stimulus generation uses a separate strict root-object schema that returns one shared stimulus and an array of child questions.

- The global feature flag selects whether stimulus generation is eligible; it does not make fields conditionally required inside one oversized model schema.
- Every field in each OpenAI structured-output schema is required. Nullable values represent an allowed absence where necessary.
- The stimulus bundle is validated as a whole before persistence.
- The backend assigns IDs, positions, and derived fields, then flattens the bundle into independently stored child payloads.
- A model-generated identifier is never trusted as the database grouping key.

### Stored and runtime fields avoid redundant truth

- The presence of validated stimulus content is the source of truth for whether a question has a stimulus.
- Runtime `hasStimulus` and `hasDiagram` values are derived for presentation and compatibility; new storage does not rely on those booleans to establish relationships.
- Existing top-level diagram payloads remain readable without rewriting old rows.
- A new child's content hash includes canonicalized stimulus content and the child question content, so identical stems attached to different stimuli do not collide.
- The shared `stimulusId` is not included in the content hash because regenerated identical content should still deduplicate.

### Quiz assembly is an ordered backend operation

New quizzes are assembled by one backend operation that returns the complete ordered question list. The existing single-question request remains the path for unlimited practice.

- Do not concurrently fill independent client-side quiz slots when set-aware assembly is enabled; concurrency would make sibling ordering nondeterministic.
- Select an eligible seed question. If it is discrete, append one question.
- If the seed belongs to a stimulus set, load its eligible siblings, start at the seed's `stimulusPosition`, continue forward, and wrap once when needed.
- Append at most the number of remaining quiz slots.
- After visiting a set, exclude its `stimulusId` from the rest of that quiz assembly so another sibling cannot cause the same set to be selected twice.
- Skip inactive or individually ineligible siblings while preserving the relative order of eligible siblings.
- Continue selecting blocks until the exact requested count is reached.
- Never repeat a child question merely to reach the requested count. If the eligible pool cannot supply enough unique children, return a clear insufficient-pool result and request refill rather than silently duplicating questions.
- Shared and previously persisted quizzes continue loading their fixed question IDs directly; the feature flag does not reassemble or filter them.

### Quizzes target a course-specific stimulus proportion

Set-aware quiz assembly uses the unified catalog's stimulus-question frequency for the selected course and unit. Unlimited practice remains ordinary child-level random selection.

- Convert the configured frequency into a desired number of stimulus-backed child questions for the requested quiz length.
- Prefer the next eligible discrete question or stimulus block according to which choice moves the quiz closer to that desired count.
- Prefer an eligible set whose size fits the remaining stimulus target when one is available.
- Once a set is selected, continue through its eligible children until the set is exhausted or the quiz is full. Do not split a set solely to hit the frequency target exactly.
- The frequency is therefore enforced as a best-fit target with a tolerance of at most one selected set, not as a reason to violate set traversal or total quiz length.
- A unit-specific quiz uses its resolved unit policy. An all-units quiz uses the course default while preserving each selected question's own unit.
- When the flag is off, the effective target is zero and no new stimulus-backed pool question is selected.
- If the eligible pool lacks enough questions of the preferred kind, fill with unique eligible questions of the other kind and record the target deviation for operational review.

### Pool accounting remains child-based

- Pool capacity and active inventory count child questions, not stimulus groups.
- Generation budgets are charged by the number of accepted child questions, not merely by the number of model calls.
- Course and unit stimulus frequency targets describe the desired proportion of answerable child questions served with a stimulus.
- A set is persisted atomically even if doing so overfills a pool target by fewer than the configured maximum set size; do not discard valid siblings solely to hit an operational count exactly.
- Quality and admin surfaces should group children by `stimulusId` for inspection while retaining child-level status and counts.

## Working domain model

- **Stimulus**: Shared source material containing text, a semantic diagram, or both.
- **Stimulus question**: One independently answerable MCQ attached to a stimulus.
- **Stimulus set**: A stimulus with more than one attached question.
- **Child question**: An ordinary MCQ attached to a stimulus. It retains its own question ID and answer lifecycle.
- **Discrete question**: An existing MCQ with no stimulus relationship.

## Open decisions

- Translate the source-backed course matrix into concrete catalog policy values and review app-authored defaults.
- Choose the small initial group of enabled courses after reviewing the complete policy matrix.
