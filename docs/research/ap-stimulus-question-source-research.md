# AP stimulus and multi-question-set source research

Research date: **2026-09-03**
Repository scope: the 25 courses in `src/lib/data/ap-classes-data-08212026.json`
Source boundary: first-party College Board/AP Central course pages, current exam pages, and current Course and Exam Descriptions (CEDs). No released question text is reproduced here.

## Executive conclusion

The product should not have one universal AP stimulus rule. A small universal storage/runtime model is appropriate, but generation eligibility, stimulus form, and set size must come from course configuration with optional unit overrides.

The strongest source-backed patterns are:

- Shared-stimulus MCQ sets are explicit in biology, chemistry, all four represented physics courses, environmental science, statistics, both English courses, all three represented history courses, U.S. and comparative government, human geography, both computer science courses, and Spanish Language.
- College Board publishes exact or bounded questions-per-set for only some courses. Biology uses 4–5; history uses 3–4; AP Computer Science A uses 2; the revised AP Statistics exam uses two sets of 3; U.S. Government uses 2–4 depending on source type; Comparative Government uses 2–3; English Literature uses 8–13; English Language uses different 4–14 ranges by set; AP Computer Science Principles has 5 questions tied to one reading passage; and the 2027 Spanish Language format uses 11 sets of 5.
- Chemistry and the represented physics exams explicitly use discrete questions and shared-stimulus/data sets, but their public exam overviews do not publish a questions-per-set range. AP Environmental Science publishes the number and kinds of sets, not the number of questions in each set. Human Geography publishes the share and forms of stimulus-backed items, not a set-size range. These sizes should remain `unknown` until a sourced or explicitly product-calibrated value is entered in the catalog.
- The public exam overviews for Calculus AB/BC, Precalculus, Psychology, Macroeconomics, and Microeconomics do not specify shared-prompt MCQ sets. Their course/exam descriptions still rely on scenarios, data, graphs, tables, code-like representations, or other representations in individual questions. Treat `setSize = 1` as the conservative default for those courses unless a current CED explicitly supports a shared set.
- Some official AP stimulus forms are outside the planned original-AI text/semantic-diagram scope. Spanish requires audio; history can use authentic primary sources and paired sources; English Literature uses literary passages; Human Geography includes photographs/landscapes; government can use foundational documents and political cartoons. The first release should not fabricate an “authentic” source, quotation, author, date, or document.

## Represented course inventory

The repository catalog contains:

1. AP Biology
2. AP Chemistry
3. AP Physics 1
4. AP Physics 2
5. AP Physics C: Mechanics
6. AP Physics C: Electricity and Magnetism
7. AP Environmental Science
8. AP Calculus AB
9. AP Calculus BC
10. AP Statistics
11. AP Precalculus
12. AP Computer Science A
13. AP Computer Science Principles
14. AP English Language and Composition
15. AP English Literature and Composition
16. AP United States History
17. AP World History: Modern
18. AP European History
19. AP United States Government and Politics
20. AP Comparative Government and Politics
21. AP Psychology
22. AP Human Geography
23. AP Macroeconomics
24. AP Microeconomics
25. AP Spanish Language and Culture

This matches the relevant subjects on College Board's [AP Courses and Exams index](https://apcentral.collegeboard.org/courses).

## Source-backed course matrix

“V1 representation” below is an implementation recommendation for original AI-generated content, not a College Board rule.

| Course(s)                                                              | College Board evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |            Published set size | Recommended V1 representation                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP Biology                                                             | The exam includes discrete questions and sets tied to a shared stimulus. The CED identifies visual representation, data, experimental, and argumentation practices. [Exam](https://apcentral.collegeboard.org/courses/ap-biology/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf)                                                                                                                                                                                                                                                                    |                           4–5 | Text, semantic diagram/data display, or mixed; sets enabled.                                                                                                                                                                |
| AP Chemistry                                                           | The exam includes discrete questions and question sets based on a stimulus or data. [Exam](https://apcentral.collegeboard.org/courses/ap-chemistry/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf)                                                                                                                                                                                                                                                                                                                                                |    Not published on exam page | Text, particle/model diagram, table/graph, or mixed; record set size as unknown until product-calibrated.                                                                                                                   |
| AP Physics 1, AP Physics 2, AP Physics C: Mechanics, AP Physics C: E&M | Each current exam page describes discrete questions and question sets with a stimulus or data. [Physics 1](https://apcentral.collegeboard.org/courses/ap-physics-1/exam) · [Physics 2](https://apcentral.collegeboard.org/courses/ap-physics-2/exam) · [C: Mechanics](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam) · [C: E&M](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism/exam)                                                                                                                                                           |   Not published on exam pages | Text/scenario, apparatus or free-body/circuit/field diagram, graph/table, or mixed; record set size as unknown until product-calibrated.                                                                                    |
| AP Environmental Science                                               | The exam has individual and set-based MCQs: 3–5 quantitative-data sets, 3–5 qualitative/model/map sets, and 2 text-source sets. Those figures count sets, not children per set. [Exam](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf)                                                                                                                                                                                                                            |                 Not published | Text, quantitative diagram/table/graph, qualitative model/map, or mixed. Exclude photographic/landscape fidelity in V1.                                                                                                     |
| AP Calculus AB and BC                                                  | The exam specifies analytical, graphical, tabular, and verbal representations, but does not publish a shared-set MCQ pattern. [AB exam](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam) · [BC exam](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-and-bc-course-and-exam-description.pdf)                                                                                                                                                                                                            |  No shared-set contract found | Single questions with graph/table/verbal context; sets off by default.                                                                                                                                                      |
| AP Statistics                                                          | The revised 2027 exam includes individual questions and two shared-prompt sets of 3. One set focuses on probability/random variables/distributions and one on regression. [Exam](https://apcentral.collegeboard.org/courses/ap-statistics/exam) · [Revision notice](https://apcentral.collegeboard.org/courses/ap-statistics/future-revisions)                                                                                                                                                                                                                                                             |                             3 | Text plus table/graph; set generation should be limited to the mapped probability and regression app units until the app's 9-unit catalog is reconciled with the revised official 5-unit framework.                         |
| AP Precalculus                                                         | The exam page publishes calculator partitions but no shared-set MCQ pattern. [Exam](https://apcentral.collegeboard.org/courses/ap-precalculus/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-precalculus-course-and-exam-description.pdf)                                                                                                                                                                                                                                                                                                                                                   |  No shared-set contract found | Single questions with graph/table/verbal context; sets off by default.                                                                                                                                                      |
| AP Computer Science A                                                  | The MCQ section is mostly individual, with 1–2 sets of 2 questions. [Exam](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description.pdf)                                                                                                                                                                                                                                                                                                                                              |                             2 | Shared code/scenario/table text; optional semantic flow/grid diagram; sets enabled.                                                                                                                                         |
| AP Computer Science Principles                                         | Five single-select questions relate to one reading passage about a computing innovation. The CED also shows graphical representations such as robot grids in program-code questions. [Exam](https://apcentral.collegeboard.org/courses/ap-computer-science-principles/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-course-and-exam-description.pdf)                                                                                                                                                                                                           | 5 for the reading-passage set | Text passage, optionally with a flowchart/grid; one configured reading-passage set form.                                                                                                                                    |
| AP English Language                                                    | The MCQ section has five sets: two reading sets of 11–14 questions, two writing sets of 7–9, and one writing set of 4–6. [Exam](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf)                                                                                                                                                                                                                                                             |         4–14 depending on set | Original nonfiction/draft text only in V1. Long set sizes are valid but expensive; smaller sets must be described as practice sets, not exam-format replicas.                                                               |
| AP English Literature                                                  | Five passage sets contain 8–13 questions each and use prose fiction, drama, or poetry. [Exam](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf)                                                                                                                                                                                                                                                                                           |                          8–13 | Original prose/poetry only. Do not invent attribution or imply an AI-written passage is an authentic published work.                                                                                                        |
| AP U.S., World, and European History                                   | Questions usually appear in sets of 3–4 and include primary/secondary texts, images, graphs, and maps. The U.S. History CED also says a set may have one or more stimuli and identifies paired text-based stimuli. [U.S. History](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam) · [World History](https://apcentral.collegeboard.org/courses/ap-world-history/exam) · [European History](https://apcentral.collegeboard.org/courses/ap-european-history/exam) · [U.S. History CED](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf) |                           3–4 | V1 should allow original explanatory text and original data/maps, but not fabricated primary-source quotations or fake attribution. Full-fidelity source sets require a later sourced-content pipeline.                     |
| AP U.S. Government                                                     | About 30 MCQs are individual. Set types include five quantitative sets of 2–3, two text sets of 3–4, and three visual sets of 2. [Exam](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics/exam) · [CED](https://apcentral.collegeboard.org/pdf/ap-us-government-and-politics-course-and-exam-description.pdf)                                                                                                                                                                                                                                                            |                   2–4 by type | Quantitative/infographic and original analytical text are suitable. Required foundational documents and attributed sources need later sourced-content handling.                                                             |
| AP Comparative Government                                              | The exam has 40–44 individual questions, three quantitative sets and two secondary-source text sets. The CED specifies 2–3 questions per set. [Exam](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-comparative-government-and-politics-course-and-exam-description.pdf)                                                                                                                                                                                                                                  |                           2–3 | Quantitative charts/tables/maps and clearly original explanatory text; sets enabled. Country coverage constraints remain course-specific.                                                                                   |
| AP Psychology                                                          | The MCQ section assesses concept application, data analysis, and scientific investigation, but the public exam overview does not state a shared-set pattern. [Exam](https://apcentral.collegeboard.org/courses/ap-psychology/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-psychology-course-and-exam-description.pdf)                                                                                                                                                                                                                                                                     |  No shared-set contract found | Single question with original study scenario, summary, table, or graph; sets off until the current CED supports a size rule.                                                                                                |
| AP Human Geography                                                     | Individual and set-based questions are used. About 30%–40% of MCQs reference maps, tables, charts, graphs, images, infographics, or landscapes, split roughly between quantitative and qualitative sources. [Exam](https://apcentral.collegeboard.org/courses/ap-human-geography/exam) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf)                                                                                                                                                                                                            |                 Not published | Charts/tables/maps/infographics and text; record set size as unknown until product-calibrated. Exclude photographs/landscapes in V1.                                                                                        |
| AP Macroeconomics and Microeconomics                                   | The public exam pages do not publish shared-prompt MCQ sets. The course work relies on economic models, graphs, data, and reasoning. [Macro exam](https://apcentral.collegeboard.org/courses/ap-macroeconomics/exam) · [Micro exam](https://apcentral.collegeboard.org/courses/ap-microeconomics/exam) · [Macro CED](https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf) · [Micro CED](https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf)                                                                         |  No shared-set contract found | Single question with original scenario and semantic economic graph/table; sets off by default.                                                                                                                              |
| AP Spanish Language                                                    | Effective May 2027, all 55 MCQs appear in 11 sets of 5. Each set uses one or two audio or written texts: five listening sets and six reading sets. [Exam](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture/exam) · [2026–27 CED](https://apcentral.collegeboard.org/media/pdf/ap-spanish-language-and-culture-course-and-exam-description-effective-fall-2026.pdf)                                                                                                                                                                                                               |                             5 | V1 can represent only original reading sets, including article-plus-chart. Listening/audio must be disabled until audio generation, playback, accessibility, and review exist. Generated text is not an “authentic source.” |

## Minimum universal V1 data model

For the already chosen first-release boundary of original AI-generated text and semantic diagrams, the smallest common model needs an **ordered source array**. This is not hypothetical flexibility: official patterns include article-plus-chart, passage-plus-flowcharts, and paired historical sources.

```text
stimulus
  stimulusId          server-generated stable ID
  sources[]           ordered, at least one item
    label             string or null
    text              string or null
    diagram           DiagramSpec or null
  provenance          fixed value: ai-generated-original
  disclosure          fixed student-facing/or internal provenance text

question relationship
  stimulusId          null for an existing discrete question
  setPosition         0-based integer when attached
  setSize             positive integer when attached
```

Rules:

- Every source item has all three fields required in the generation schema: `label`, `text`, and `diagram`. `label`, `text`, and `diagram` may be nullable, but at least one of `text` or `diagram` must be non-null. This fixed required shape is compatible with strict structured-output schemas while supporting text-only, diagram-only, and mixed items.
- Array order is meaningful. Labels such as “Source A” and “Source B” remain explicit rather than being inferred from rendered text.
- A set of one is valid and represents a standalone stimulus-backed question.
- A set of two or more represents a shared stimulus set. Every child remains an independently answerable MCQ with its own question ID, choices, answer, explanation, attempts, history, bookmark state, and quality state.
- The shared immutable stimulus payload may be duplicated into each child JSONB payload for V1, but the server-generated `stimulusId`, set order, and set size must be identical and validated across siblings.
- The model intentionally does not claim full AP-source fidelity. Audio, video, arbitrary images, sourced/authentic documents, and independently editable stimulus records are later capabilities.

This ordered array is still intentionally narrow: its items support only text and an Examfig-style semantic `DiagramSpec`. It is not a generic attachment system. Examfig-style semantic diagrams do not automatically cover photographs, artwork, landscapes, political cartoons, or audio.

## Configuration that cannot be universalized

The unified AP catalog should own a course default with optional unit overrides. The minimum policy surface is:

```text
stimulusPolicy
  enabled
  allowedModes         text | diagram | mixed
  setsEnabled
  minQuestionsPerSet
  maxQuestionsPerSet
  setSizeBasis         official | product-calibrated | unknown
  allowedDiagramKinds  course-specific semantic diagram families
  restrictions         generation and review rules
```

Do not infer this policy from UI feature flags or from whether a unit happens to contain words such as “graph” or “source.” The following vary by course or unit:

- Whether shared sets are supported at all.
- Exact or target set size.
- Text length and genre: scientific scenario, nonfiction passage, draft for revision, literary passage, historical source framing, government source, computing-innovation passage, or Spanish reading.
- Diagram family: graph, table, map, scientific model, apparatus, circuit, field, free-body diagram, particle model, flowchart, grid, infographic, or economic graph.
- Whether mixed text-plus-diagram stimuli are appropriate.
- Whether multiple labeled sources are needed.
- Authenticity and attribution rules.
- Required country coverage for Comparative Government.
- Language and media constraints for Spanish.
- Calculator/reference-sheet assumptions.
- Whether all children must remain inside one app unit.

### Recommended inheritance rule

Use the course policy as the default, then apply an override only where an app unit materially differs. Missing unit policy means “inherit,” not “disabled.” This avoids maintaining 179 mostly duplicated unit records while still allowing precise exceptions.

For V1 unit practice, generate every child in a set under one target app unit and enforce the existing strict-unit-scope rules for every child. Official AP stimulus sets are not universally defined as belonging to exactly one instructional unit, so cross-unit sets should be a later explicit feature rather than an accidental result.

### One source-backed unit exception already known

The revised AP Statistics exam explicitly assigns its two 3-question sets to probability/random variables/distributions and regression analysis. In the current app's legacy 9-unit labels, those correspond most directly to:

- `ap-statistics-unit-4` - Probability, Random Variables, and Probability Distributions
- `ap-statistics-unit-2` - Exploring Two-Variable Data, which contains regression analysis

This mapping must be revisited when the app catalog moves from its legacy 9 AP Statistics units to the revised official 5-unit framework. [College Board's revision notice](https://apcentral.collegeboard.org/courses/ap-statistics/future-revisions) explicitly says the official course was consolidated from the old structure into five units.

For other courses, College Board primarily specifies exam-wide stimulus forms and skills rather than a definitive per-unit “stimuli allowed” matrix. Absence of a stimulus form from a CED sample question is not evidence that the form is forbidden in that unit. Unit-level mode restrictions therefore remain an app-authored curriculum and quality decision that should be reviewed course by course.

## Safe initial policy recommendation

1. Enable exact source-backed set sizes where College Board publishes them.
2. Where College Board confirms sets but publishes no child count, store the size as `unknown`. Enable generation only after entering an explicitly product-calibrated range, with that basis recorded separately from official values.
3. Where no shared-set contract was found, allow standalone stimulus questions but keep generated multi-question sets off.
4. Restrict V1 to original text, semantic diagrams, and their combination.
5. Disable unsupported stimulus forms instead of approximating them deceptively:
   - audio/listening;
   - photographs, landscapes, and artwork that require visual-source fidelity;
   - authentic literary, primary, secondary, or foundational documents;
   - quotations or source metadata that the model could fabricate.
6. Require provenance to identify all V1 stimuli as original AI-generated practice material.
7. Review a shared stimulus once at set scope. A stimulus-level rejection disables all children; a child-level rejection disables only that child.

## Important caveats

- College Board updates CEDs and exam designs. The [AP Course and Exam Changes page](https://apcentral.collegeboard.org/courses/how-ap-develops-courses-and-exams/course-changes-overview) should be checked when the catalog's `asOf` date is refreshed.
- AP Statistics and AP Spanish Language have material 2026–27 revisions. Old CED search results are still discoverable, so implementation should use the effective-fall-2026 Spanish CED and the revised Statistics materials.
- The effective-fall-2026 Spanish CED specifies 11 sets of exactly 5 questions, each using one or two audio or written texts. V1 must disable listening sets; silently replacing audio with a transcript changes the assessed modality and is not an acceptable fallback.
- Counts such as “3–5 quantitative sets” for AP Environmental Science describe the number of sets on the full exam, not questions per set.
- “Original AI-generated” and “authentic source” are not interchangeable. Generated source-like text must never be attributed to a real person or represented as a historical/literary document.
- Public exam pages do not always expose every specification in the CED. “No shared-set contract found” means the current first-party pages reviewed here do not justify enabling generated sets by default; it is not a claim that no official item bank ever groups those questions.
