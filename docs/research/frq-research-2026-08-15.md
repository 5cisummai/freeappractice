# AP Free-Response Research for Supported Courses

**Research date:** 2026-08-15  
**Repository scope:** `src/lib/question-bank/frq/profiles.server.ts` currently supports **AP Biology**, **AP Calculus AB**, and **AP English Language**.  
**Source policy:** This report uses primary College Board sources only: current AP Central course and exam pages, College Board Course and Exam Descriptions (CEDs), released College Board free-response questions, scoring guidelines, chief reader reports, and College Board sample student responses. It does not use prep-company summaries, teacher blogs, or unofficial answer keys.

## Executive summary

The three supported courses do not share one meaningful FRQ format.

| Course              | Official FRQ structure                                                                                                             | Official scoring shape                                                                                                                                                  | Main materials or representations                                                                                                     | Biggest accuracy risk in the current generic profile                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP Biology          | 6 questions: 2 long questions worth 9 points each and 4 short questions worth 4 points each; 90 minutes                            | Criterion-level points tied to specific biological claims, data interpretation, methods, calculations, predictions, models, and justifications; 34 raw FRQ points total | Authentic scientific scenarios; tables, graphs, visual models, experimental designs, and biological processes                         | A generic text-only multi-section task misses named task types, graph construction, model representation, data controls, null hypotheses, and the exact 9/4-point split |
| AP Calculus AB      | 6 questions, each worth 9 points; Part A: 2 questions/30 minutes/calculator required; Part B: 4 questions/60 minutes/no calculator | Point-by-point method, setup, answer, units, representation, and justification credit; supporting work is central and points can be banked independently                | Algebraic, graphical, tabular, and verbal representations; contextual modeling; calculator and non-calculator mathematics             | A generic rubric with broad levels will not reproduce the method-credit, eligibility, notation, rounding, calculator, and theorem-justification rules                   |
| AP English Language | 3 essays in 2 hours 15 minutes including a 15-minute reading period; Synthesis, Rhetorical Analysis, Argument                      | Each essay is a 6-point rubric: Row A thesis 0–1, Row B evidence/commentary 0–4, Row C sophistication 0–1                                                               | Six-source synthesis set with visual/quantitative material; 600–800-word nonfiction passage; rhetorical or literary concept/quotation | A single “argument-analysis” format cannot model three different prompts, source-count rules, rhetorical-choice analysis, or the distinct sophistication criteria       |

The first practical conclusion is that the application should treat `formatId`, prompt structure, rubric semantics, and response data as course-specific. `supportedFormats: ['materials', 'multi-section', 'text']` is an internal implementation label, not a College Board description.

## Currency, version, and access notes

As of the research date, AP Central exposes the 2026 released FRQ question PDFs for all three courses, but the 2026 sections of the past-question pages do not expose scoring guidelines, chief reader reports, or sample-response links. The latest fully scored public release used for detailed rubric and misconception analysis in this report is 2025. AP Central also states that it provides the three most recent years of released materials and that earlier secure materials remain in AP Classroom for authorized educators.

The current course pages show the following transition notes:

- **Biology:** the hosted CED is effective Fall 2025. The current exam page says the 6-question, 90-minute FRQ structure and point values remain stable year to year.
- **Calculus AB:** the current exam page says the FRQ structure remains consistent, while multiple-choice count and timing change beginning with the May 2027 exam. The hosted CED is labeled effective Fall 2020 and is currently served with a 2026 College Board copyright notice; use the current exam page plus the 2025/2026 released FRQs for current administration details.
- **English Language:** the hosted CED is effective Fall 2024. The current exam page says the three FRQ categories and point values remain consistent year to year. The linked generic scoring-rubric PDF is labeled “Effective Fall 2019” and remains the College Board’s general rubric reference.

Where 2026 official material is available but not yet accompanied by public scoring information, this report marks the limitation rather than guessing at a 2026 rubric.

## Cross-course principles that should shape the FRQ system

### 1. Generate the official task type first, then fill in content

An accurate generator needs a task-family selector before it writes a prompt. The task family determines:

- what stimulus is required;
- how many sections or subparts are appropriate;
- what evidence a student must produce;
- what response representation is required;
- how many points the task has;
- what kinds of answers can earn each point; and
- which dependencies or “eligibility” rules the grader must enforce.

For example, AP Biology’s long graphing task and AP English Language’s synthesis essay are both “materials plus multiple sections” in application terms, but they are not pedagogically or psychometrically interchangeable.

### 2. Keep student-facing prompt data separate from private scoring data

College Board released scoring guidelines expose acceptable-response examples and scoring notes to teachers, but a practice student should receive only the prompt, materials, and response instructions. The private record should preserve:

- course and task family;
- exam-style question number or local task role;
- section/subpart identifiers;
- point value per subpart or rubric row;
- accepted claims, calculations, evidence requirements, and reasoning requirements;
- dependencies between points;
- notation, unit, rounding, calculator, or graph requirements; and
- the source/version of the rubric used.

### 3. “Correct concept” is not enough when the official rubric requires application

The chief reader reports repeatedly distinguish a definition from an applied explanation. In Biology, a response can identify a control but fail to justify why that control is useful. In Calculus, a numerical answer can fail because the setup or theorem condition is absent. In English, naming a rhetorical device or summarizing a source is not the same as explaining how it supports a line of reasoning.

### 4. The generator needs structured representations, not only strings

The existing `FrqMaterial` and `FrqSection` model can carry text, but accurate tasks need typed material metadata. At minimum, the model should be able to represent:

- `materialKind`: passage, data table, graph, visual model, quotation, source set, or scenario;
- `sourceLabel` and attribution metadata for English synthesis sources;
- `isQuantitative`, `isVisual`, and `requiresCitation` flags;
- table/graph data and axis metadata where the student is expected to calculate or construct a representation;
- calculator policy per section for Calculus;
- response representation such as paragraph, equation, numerical answer with work, graph, model, or table; and
- a rubric criterion whose evidence is tied to a particular part of the material.

If the current product must remain text-only, the product should say that it is a text/LaTeX practice approximation for tasks that officially require graphing or visual representation. It should not claim that a text-only answer is identical to the official response mode.

### 5. Do not use released prompts or passages as generation templates in a way that copies them

The official released questions and scored samples are excellent format and rubric references. The application’s own generator should create wholly original scenarios, data, passages, source sets, quotations, and answer keys. For English Language especially, the official synthesis question uses excerpts and visual/quantitative sources that may be copyrighted or licensed; an original practice set should use original or appropriately licensed materials and preserve the _relationships_ among source types, not reproduce an official set.

## AP Biology

### Official source and version record

| Source                                                                                                                                   | Version/date note                                                                                                  | What it establishes                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology)                                                          | Current AP Central page; identifies the CED as updated for the 2025–26 school year                                 | Course units, science practices, unit names, and current CED link                                                                  |
| [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam)                                                       | Current page reviewed 2026-08-15; current page displays the upcoming 2027 exam but describes the stable FRQ format | Current section timing, question counts, point split, and named question types                                                     |
| [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf)        | Effective Fall 2025, V.1                                                                                           | Detailed FRQ task families, point allocation by part, science-practice alignment, task verbs, and sample exam material             |
| [2026 AP Biology FRQs](https://apcentral.collegeboard.org/media/pdf/ap26-frq-biology.pdf)                                                | 2026 release; questions available, public scoring links not shown on the past-question page                        | Confirms the current prompt layout and recurring task pattern; no official 2026 scoring guide was publicly linked at research time |
| [2025 AP Biology FRQs](https://apcentral.collegeboard.org/media/pdf/ap25-frq-biology.pdf)                                                | 2025 release                                                                                                       | Full current-format prompt wording, directions, timing recommendations, and six-question composition                               |
| [2025 AP Biology Scoring Guidelines](https://apcentral.collegeboard.org/media/pdf/ap25-sg-biology.pdf)                                   | 2025 release                                                                                                       | Point-level criteria and acceptable-response examples                                                                              |
| [2025 AP Biology Chief Reader Report](https://apcentral.collegeboard.org/media/pdf/ap25-cr-report-biology.pdf)                           | 2025 release                                                                                                       | What each question expected, common misconceptions, skill gaps, and scoring patterns                                               |
| [2025 Biology sample response and commentary, FRQ 1](https://apcentral.collegeboard.org/media/pdf/ap25-apc-biology-q1.pdf)               | 2025 release                                                                                                       | Official scored student samples and commentary; AP Central also links samples for Questions 1–6                                    |
| [AP Biology past exam questions and scoring information](https://apcentral.collegeboard.org/courses/ap-biology/exam/past-exam-questions) | Current AP Central index                                                                                           | Official index to 2023–2026 question, scoring, chief-reader, statistics, and sample-response files                                 |

### Exam-level format

The current AP Biology exam page states:

- Section II has **6 free-response questions**;
- Section II lasts **1 hour 30 minutes** and is **50% of the exam score**;
- Questions 1 and 2 are long questions worth **9 points each**;
- Questions 3–6 are short questions worth **4 points each**;
- the recommended pacing is about **25 minutes for each long question** and **10 minutes for each short question**; and
- students can move between questions until time expires.

The public 2025 prompt directions say that answers must be written in paragraph form, that outlines, bulleted lists, or diagrams alone are not acceptable, and that diagrams may supplement a discussion unless the question specifically calls for one. The 2026 prompt says only work in the response booklet is scored and again states that a diagram alone does not receive credit. The current exam page describes the exam as hybrid digital: students view questions in Bluebook and handwrite FRQ answers in paper booklets.

### Six official Biology FRQ task families

The CED explicitly names the following six families and describes the point allocation. These are the task families the generator should select from.

| Official question role                                                           | Points | Required task shape and point allocation                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Interpreting and Evaluating Experimental Results**                          |      9 | Authentic scenario with data in a table, graph, or both. Part A: describe biological concepts/processes/models, 1 point. Part B: identify experimental methods or describe data, 3 points. Part C: identify methods, analyze data, or calculate, 3 points. Part D: make and justify predictions, 2 points.                                                            |
| **2. Interpreting and Evaluating Experimental Results with Graphing**            |      9 | Authentic scenario with data in a table. Part A: describe a biological concept/process/model, 1 point. Part B: construct the appropriate graph, 4 points. Part C: analyze data, calculate, state a null hypothesis, or predict experimental results, 2 points. Part D: make and justify predictions, 2 points.                                                        |
| **3. Scientific Investigation**                                                  |      4 | Lab-investigation scenario. Part A: describe a biological concept/process, 1 point. Part B: identify experimental procedures, 1 point. Part C: state a null hypothesis or predict results, 1 point. Part D: justify predictions, 1 point.                                                                                                                             |
| **4. Conceptual Analysis**                                                       |      4 | Authentic scenario describing a biological phenomenon with a disruption. Part A: describe a concept/process, 1 point. Part B: explain a concept/process, 1 point. Part C: predict causes/effects of a change in a biological system, 1 point. Part D: justify the prediction, 1 point.                                                                                |
| **5. Analyze Model or Visual Representation of a Biological Concept or Process** |      4 | Authentic scenario plus a visual model/representation. Part A: describe characteristics shown visually, 1 point. Part B: explain relationships among visual characteristics, 1 point. Part C: represent relationships within a biological model, 1 point. Part D: explain how the visual concept/process connects to a larger principle, process, or theory, 1 point. |
| **6. Analyze Data**                                                              |      4 | Data in a graph, table, or other visual representation. Parts A and B: describe data, 1 point each. Part C: use data to evaluate a hypothesis/prediction, 1 point. Part D: explain how results relate to biological principles, concepts, processes, or theories, 1 point.                                                                                            |

These descriptions are from the Biology CED’s exam-information section, not an inference from a few released questions. The 2025 and 2026 public papers follow the same six-role pattern.

### Biology prompt anatomy and response expectations

#### Stimulus and experimental context

Biology FRQs are usually built around a coherent scientific scenario, not a trivia question. Typical stimulus components in the 2025 and 2026 releases include:

- a biological system or phenomenon;
- the research question, claim, or hypothesis;
- experimental treatments and controls;
- the measured variable(s);
- a table, graph, plot, model, or pathway;
- enough definitions and context to make the task self-contained; and
- a sequence of questions that moves from observation to interpretation to mechanistic reasoning.

The 2025 Chief Reader Report describes Question 1 as a protein-transport experiment with siRNA treatments, controls, two figures, and a progression from identifying a dependent variable to supporting a claim about transport mechanism. Question 2 uses a signaling pathway, a table, a graph-construction task, a mutation prediction, evidence-based support, and a pathway inhibitor. Question 5 uses a metabolic-pathway model and asks students to reason about feedback inhibition and environmental disruption. Question 6 compares two datasets for different genotypes and asks students to explain why similar protein amounts can produce different phenotypes.

#### Common command verbs

The CED defines Biology verbs such as **calculate**, **construct/draw**, **describe**, **determine**, **evaluate**, **explain**, **identify**, **justify**, **make a claim**, **predict**, **represent**, **state the null hypothesis**, and **support a claim**. The distinction matters:

- **Identify** asks for information without elaboration.
- **Describe** asks for relevant characteristics.
- **Explain** asks how or why a relationship or outcome occurs using evidence and/or reasoning.
- **Justify** requires evidence plus reasoning that explains how the evidence supports or qualifies the claim.
- **Predict** asks for the cause or effect of a change or disruption in a system.
- **State the null hypothesis** requires a testable no-effect/no-difference statement tied to the variables.
- **Construct/Draw/Represent** requires an actual graph, model, relationship, or other representation when the prompt calls for it.

The generator should not use “explain” and “justify” as interchangeable labels. The scoring guidelines and chief-reader report repeatedly show that a definition, observation, or claim without the connected mechanism/evidence does not earn the higher reasoning point.

#### Data and graph requirements

Biology data tasks commonly ask students to:

- identify independent and dependent variables;
- identify or justify a control group;
- describe a treatment effect or trend;
- compare groups, figures, or genotypes;
- calculate a biological quantity and include units or appropriate precision;
- use error bars or statistical information when provided;
- construct a correctly chosen and labeled graph; and
- use data as evidence for a claim, then connect that evidence to a biological principle.

The 2025 Chief Reader Report specifically identifies graph labeling, accurate point/error-bar plotting, and appropriate y-axis scaling as common skill gaps in Question 2. A text-only implementation can accept a structured Markdown/LaTeX graph specification for practice, but it should not silently grade a prose description as equivalent to the official graph-construction task.

### Biology scoring mechanics

Biology scoring is point-based at the subpart/criterion level. The 2025 scoring guide lists each point separately and gives acceptable response examples, followed by question-specific scoring notes. This is not a holistic essay rubric and it is not a generic “level 0–4” rubric.

The grader should support:

- multiple acceptable phrasings for the same claim;
- claims that are correct only when tied to the right treatment, control, data figure, or mechanism;
- numerical answer tolerances where the official guide provides them;
- credit for a valid alternate method or explanation when the official guide permits it;
- explicit distinction between evidence and reasoning;
- graph components as separate scorable elements when a graph is required;
- a point for stating a correct null hypothesis versus a separate point for justifying a prediction; and
- question-specific dependencies, such as an explanation point that presumes a correct or usable earlier interpretation.

The 2025 guide illustrates the granularity. For Question 1, separate points cover the ribosome function, dependent variable, control purpose, treatment effect, independent variable, data identification, amino-acid calculation, data-supported claim, and membrane-transport justification. The acceptable response list may include several scientifically equivalent answers, but the answer still has to address the requested variable or mechanism.

The Chief Reader Report is especially useful as a grading-quality reference. It reports very low performance on responses that named a control without explaining its purpose, cited a figure without connecting it to the claim, or described a general membrane fact without applying it to the amino terminus and channel. It also warns against common substitutions such as “adaptation” for every evolutionary process, confusing allosteric and competitive inhibition, and treating any arithmetic difference as statistically significant.

### Biology generation requirements for this repository

The current Biology profile should eventually produce a typed family such as:

```text
biology-long-experiment
biology-long-experiment-graphing
biology-short-investigation
biology-short-conceptual-analysis
biology-short-model-visual
biology-short-data-analysis
```

For each generated question, store at least:

- `questionType` matching one of the six official families;
- `longOrShort`, `maxPoints`, and the official part-point layout;
- a stimulus with scientific scenario, definitions, experimental design, and data/model attachments;
- independent/dependent variables, controls, hypothesis, and treatment metadata when present;
- structured graph/model requirements where applicable;
- the relevant Biology science practices and learning objectives;
- criterion-specific acceptable claims and reasoning, not only a prose reference answer; and
- a private rubric that can tell evidence, mechanism, and prediction apart.

The existing profile guidance says “data-rich scientific analysis” and “do not require drawing.” That is directionally useful for some tasks, but it is not enough for official fidelity because Question 2 explicitly requires graph construction and Question 5 includes representation within a biological model. If the product intentionally stays text-only, call this an accessibility/product constraint and model the required representation in text or a structured answer object.

## AP Calculus AB

### Official source and version record

| Source                                                                                                                                                  | Version/date note                                                                                         | What it establishes                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab)                                                                 | Current page reviewed 2026-08-15                                                                          | AB unit framework, mathematical practices, CED link, and 2026–27 transition note                                |
| [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam)                                                              | Current page reviewed 2026-08-15; current page notes MCQ changes beginning May 2027                       | Current FRQ counts, timing, calculator policy, representations, and context expectations                        |
| [AP Calculus AB and BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-and-bc-course-and-exam-description.pdf) | Hosted CED labeled effective Fall 2020; current hosted file carries a 2026 College Board copyright notice | FRQ structure, mathematical-practice weighting, task verbs, sample questions, and scoring-guideline conventions |
| [2026 AP Calculus AB FRQs](https://apcentral.collegeboard.org/media/pdf/ap26-frq-calculus-ab.pdf)                                                       | 2026 release; public scoring links not shown on the past-question page                                    | Confirms current 2-question calculator Part A and 4-question non-calculator Part B prompt format                |
| [2025 AP Calculus AB FRQs](https://apcentral.collegeboard.org/media/pdf/ap25-frq-calculus-ab.pdf)                                                       | 2025 release                                                                                              | Full current-format prompt wording and directions                                                               |
| [2025 AP Calculus AB/BC Scoring Guidelines](https://apcentral.collegeboard.org/media/pdf/ap25-sg-calculus-ab.pdf)                                       | 2025 release                                                                                              | Point-by-point method, answer, justification, notation, and rounding rules                                      |
| [2025 AP Calculus AB/BC Chief Reader Report](https://apcentral.collegeboard.org/media/pdf/ap25-cr-report-calculus-ab-bc.pdf)                            | 2025 release                                                                                              | Task labels, point performance, common misconceptions, and scoring-quality advice                               |
| [2025 Calculus AB sample response and commentary, FRQ 1](https://apcentral.collegeboard.org/media/pdf/ap25-apc-calculus-ab-q1.pdf)                      | 2025 release; AP Central also links samples for Questions 1–6                                             | Official scored student work and commentary                                                                     |
| [AP Calculus AB past exam questions and scoring information](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam/past-exam-questions)        | Current AP Central index                                                                                  | Official index to 2023–2026 questions, scoring, chief-reader, statistics, and samples                           |

### Exam-level format

The current AP Calculus AB exam page describes Section II as:

- **6 free-response questions**;
- **1 hour 30 minutes** total;
- **50% of the exam score**;
- Part A: **2 questions, 30 minutes, graphing calculator required**; and
- Part B: **4 questions, 60 minutes, calculator not permitted**.

The page also says the section includes various function types and representations, a roughly equal mix of procedural and conceptual tasks, and at least two questions with a real-world context or scenario. The 2026 released paper repeats the section directions and says the response must show work, use standard mathematical notation rather than calculator syntax, and give final decimal approximations to three places unless otherwise specified.

### What Calculus AB FRQs actually ask students to do

The official format is not six identical “worked problems.” Each question is a multi-part task, normally four parts, that assembles related skills around a function, table, graph, equation, rate, accumulation context, particle, region, or model.

The 2025 Chief Reader Report labels the six AB/BC-common or AB questions as follows:

| Question role in the 2025 release | Calculator                  | Representative task family                                                                                                                   |
| --------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AB1/BC1                           | Part A, calculator required | Modeling: average value, instantaneous/average rate of change, end behavior, Extreme Value Theorem, and a global maximum argument            |
| AB2                               | Part A, calculator required | Area and volume from graphs/functions, cross sections, solids of revolution, and parallel tangent conditions                                 |
| AB3/BC3                           | Part B, no calculator       | Table-based rate, average rate of change, Intermediate Value Theorem, trapezoidal approximation, accumulation, and contextual interpretation |
| AB4/BC4                           | Part B, no calculator       | Fundamental Theorem of Calculus, points of inflection, definite integrals, absolute extrema, and graph/sign reasoning                        |
| AB5                               | Part B, no calculator       | Particle motion: position/velocity/acceleration, direction, speed increasing/decreasing, and accumulated position                            |
| AB6                               | Part B, no calculator       | Implicit differentiation, tangent-line approximation, vertical tangent, and related rates                                                    |

The exact content mix changes each year. The important stable pattern is the combination of representations, procedural execution, interpretation, and justification. The CED identifies four mathematical practices in the FRQ section:

- Practice 1, implementing mathematical processes: **35–60%**;
- Practice 2, connecting representations: **10–20%**;
- Practice 3, justification: **35–60%**; and
- Practice 4, communication and notation: **10–25%**.

The CED’s task verbs include **approximate**, **calculate/write an expression**, **determine/find**, **estimate**, **evaluate**, **explain**, **identify/indicate**, **interpret**, **justify**, **represent**, and **verify**. These verbs should be treated as scoring requirements, not stylistic variations.

### Calculator and notation requirements

For calculator-required questions, a student may use a calculator to solve an equation, find a derivative at a point, or calculate a definite integral, but the setup must be clearly indicated. If a built-in feature or program is used, the mathematical steps necessary to produce the result must be shown.

For all Calculus AB FRQs:

- show all work, even when the question does not repeat the instruction;
- use standard mathematical notation, not calculator command syntax;
- label functions, graphs, tables, and other objects used;
- give units when the context calls for them;
- give decimal answers to three places unless the prompt says otherwise; and
- write mathematical reasons and verify theorem conditions when the task asks for justification.

### Calculus scoring mechanics

Each question is worth 9 points. The scoring guideline calls the individual points `P1` through `P9`, but the actual meaning changes by subpart. Typical point roles include:

- a correct setup or formula;
- a correct derivative, integral, equation, or representation;
- a correct numerical or algebraic result;
- correct units or contextual interpretation;
- a correct sign analysis or interval analysis;
- a theorem condition and an application of the theorem;
- a global argument such as a candidates test; and
- a final answer that is eligible only after an earlier method point is earned.

The guide explicitly says that, within an individual question, at most one point is lost for inappropriate rounding. It also repeatedly permits equivalent expressions, unsimplified answers, alternate correct methods, and “banked” setup points. These are essential grading rules.

Examples from the 2025 scoring guide:

- In an average-value problem, the integral-and-division setup and the numerical answer are separate points.
- In a trapezoidal-sum problem, the form of the sum and the final answer are separate points; a nearly correct structure may earn setup credit but not the answer point.
- In an Intermediate Value Theorem task, merely saying “the function is continuous” is insufficient when the rubric requires the reason that differentiability implies continuity. The response also has to show the relevant values and conclusion.
- In a global maximum task, solving `A'(t)=0` is not the complete justification. The scoring guide accepts a candidates test with all relevant candidates/endpoints or a valid global sign argument. A local sign observation alone may not earn the global-justification point.
- In particle motion, speed increasing/decreasing depends on the signs of velocity and acceleration, not acceleration alone.
- In accumulation, an integral setup, antiderivative, and final position may be scored separately, with later points sometimes eligible only if earlier work establishes the correct integrand or antiderivative.

This means the rubric should not be represented as a simple list of answer strings. It needs criterion dependencies and alternate-method branches.

### Chief-reader patterns that matter for generation and grading

The 2025 Chief Reader Report is unusually useful for quality control. It identifies recurring errors such as:

- using `C'(t)` where the average value requires `C(t)`;
- confusing average rate of change with average value;
- omitting the setup and providing only a calculator answer;
- failing to check the hypotheses of the Intermediate Value Theorem;
- giving only a local argument when the question asks for an absolute/global conclusion;
- failing to square a radius in a volume integral;
- losing parentheses when substituting named functions;
- using an incomplete sign analysis for particle direction;
- determining speed from acceleration alone; and
- expanding a composite integrand incorrectly rather than using substitution.

The report’s teacher advice also reinforces that students should use the named functions from the prompt, communicate units and theorem conditions, and avoid unnecessary simplification that can introduce errors.

### Calculus generation requirements for this repository

The current Calculus profile should evolve toward task families such as:

```text
calculus-calculator-modeling
calculus-calculator-area-volume
calculus-noncalculator-table-rate
calculus-noncalculator-accumulation-graph
calculus-noncalculator-particle
calculus-noncalculator-implicit-related-rates
```

Those labels are implementation names, not College Board taxonomy. For every generated question, store:

- calculator policy and section time;
- named functions and representations used in the stem;
- part-level task verbs;
- units and required precision;
- whether the response requires a setup, result, interpretation, or theorem justification;
- accepted equivalent expressions and alternate methods;
- eligibility/dependency rules between points; and
- exact 9-point allocation.

The current profile’s guidance to separate setup/method credit from arithmetic accuracy is correct, but too general. The generator and grader must know _which_ method, notation, theorem condition, or global argument is required for each part.

## AP English Language and Composition

### Official source and version record

| Source                                                                                                                                                                              | Version/date note                                                                           | What it establishes                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [AP English Language course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition)                                                                   | Current AP Central page; hosted CED is identified as core document                          | Course framework, skills, and current CED link                                                             |
| [AP English Language exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam)                                                                | Current page reviewed 2026-08-15; current page displays the upcoming 2027 exam              | Current 3-essay format, time, categories, source count, and scoring-rubric link                            |
| [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf) | Effective Fall 2024, V.1                                                                    | Exam structure, stable prompt wording, source/passages requirements, task verbs, and CED sample rubrics    |
| [AP English Language scoring rubrics](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-frqs-1-2-3-scoring-rubrics.pdf)                              | “Effective Fall 2019”; still linked by the current College Board exam page                  | General 6-point rubrics and decision rules for all three FRQ types                                         |
| [2026 AP English Language FRQs](https://apcentral.collegeboard.org/media/pdf/ap26-frq-english-language.pdf)                                                                         | 2026 release; questions available, public scoring links not shown on the past-question page | Confirms current essay directions, timing recommendations, six-source synthesis layout, and prompt wording |
| [2025 AP English Language FRQs, Set 1](https://apcentral.collegeboard.org/media/pdf/ap25-frq-english-language-set-1.pdf)                                                            | 2025 release                                                                                | Full released prompt set                                                                                   |
| [2025 AP English Language FRQs, Set 2](https://apcentral.collegeboard.org/media/pdf/ap25-frq-english-language-set-2.pdf)                                                            | 2025 release                                                                                | Second official administration/set; confirms stable task families across sets                              |
| [2025 English Language Scoring Guidelines, Set 1](https://apcentral.collegeboard.org/media/pdf/ap25-sg-english-language-set-1.pdf)                                                  | 2025 release                                                                                | Current prompt-specific application of the 6-point rubric                                                  |
| [2025 English Language Scoring Guidelines, Set 2](https://apcentral.collegeboard.org/media/pdf/ap25-sg-english-language-set-2.pdf)                                                  | 2025 release                                                                                | Second official rubric application                                                                         |
| [2025 English Language Chief Reader Report, Set 1](https://apcentral.collegeboard.org/media/pdf/ap25-cr-report-english-language-set-1.pdf)                                          | 2025 release                                                                                | Performance patterns, common errors, and instructional/scoring observations                                |
| [2025 English Language Chief Reader Report, Set 2](https://apcentral.collegeboard.org/media/pdf/ap25-cr-report-english-language-set-2.pdf)                                          | 2025 release                                                                                | Second-set performance report                                                                              |
| [2025 English Language sample response and commentary, Synthesis Q1 Set 1](https://apcentral.collegeboard.org/media/pdf/ap25-apc-english-language-q1-set-1.pdf)                     | 2025 release; AP Central also links samples for Q1–Q3 in both sets                          | Official scored student sample and commentary                                                              |
| [AP English Language past exam questions and scoring information](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam/past-exam-questions)          | Current AP Central index                                                                    | Official index to 2023–2026 prompts, rubrics, chief-reader reports, statistics, and samples                |

### Exam-level format

The current AP English Language exam page states:

- Section II has **3 free-response questions**;
- the section lasts **2 hours 15 minutes**, including a **15-minute reading period**;
- Section II is **55% of the exam score**;
- the recommended time is approximately **40 minutes per essay** after the reading period; and
- the three categories are **Synthesis**, **Rhetorical Analysis**, and **Argument**.

The 2025 and 2026 prompt directions state that the responses must be essays judged for clarity, effectiveness in addressing the topic, and quality of writing. Students may move between questions until time expires. The 2026 exam is fully digital, with responses entered in Bluebook; annotations are not included as part of the answer.

### The three official essay types

#### Question 1: Synthesis

The CED says the task presents **six sources** organized around a topic. Two sources are visual, including at least one quantitative source; the remaining sources are text excerpts of approximately 500 words each. The student must develop a position and synthesize material from at least three sources. Sources can be identified by letter or description through quotation, paraphrase, or summary.

The stable prompt structure is:

1. topical introduction/background;
2. “Carefully read the following six sources, including the introductory information for each source”; and
3. “Write an essay that synthesizes material from at least three of the sources and develops your position on [specific subject].”

Generation requirements:

- six genuinely related sources, not six unrelated quotations;
- two visual sources, one of which is quantitative;
- source introductions that establish provenance and context sufficiently for rhetorical analysis and synthesis;
- at least three sources that can support more than one defensible position;
- at least one source pair that invites agreement, tension, qualification, or comparison;
- safe and original or properly licensed practice materials; and
- a prompt that asks the student to develop a position, not merely summarize the sources.

#### Question 2: Rhetorical Analysis

The CED says the task presents a nonfiction prose passage of approximately **600–800 words**. The student writes an essay analyzing the writer’s rhetorical choices to develop or achieve an argument, purpose, or message. The stable prompt includes background on the rhetorical situation, the instruction to read the passage carefully, and the instruction to analyze the choices the writer makes.

Generation requirements:

- an original nonfiction passage with a discernible rhetorical situation;
- identifiable writer/speaker, audience, purpose, exigence/context, and message;
- multiple meaningful choices in diction, syntax, comparison, organization, appeals, tone, examples, evidence, concession, narration, or other rhetorical construction;
- choices that work together, not a checklist of disconnected devices;
- enough specific language and structural movement for students to cite evidence; and
- a prompt that asks how choices develop/achieve/convey a purpose, argument, or message.

The Chief Reader Report warns that weak responses often name rhetorical strategies without explaining their function, rely on the prompt’s language, or discuss isolated choices without analyzing relationships among choices throughout the passage.

#### Question 3: Argument

The CED says the task presents a literary or rhetorical concept, idea, quotation, or topical discussion. The student writes an evidence-based essay arguing a position. Unlike synthesis, the prompt does not provide six sources that students must cite. Unlike rhetorical analysis, the student does not analyze another writer’s choices as the primary task.

The stable prompt structure is a topical introduction, quotation(s), or background followed by: “Write an essay that argues your position on [specific subject from the introduction].”

Generation requirements:

- a debatable claim with multiple defensible positions;
- wording that supports qualification or a nuanced extent-to-which position;
- no hidden requirement to agree with the quotation or adopt a preferred ideology;
- opportunities for specific evidence from history, current events, literature, personal observation, or other relevant knowledge; and
- a prompt that rewards reasoning and evidence rather than vocabulary or a predetermined conclusion.

### English scoring rubric: common 6-point architecture

All three essays use three rows, each scored independently:

| Row                            | Points | General meaning                                                                                                                                                                                                                                                                        |
| ------------------------------ | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Thesis**                  |    0–1 | A defensible thesis that responds to the prompt. For synthesis, it presents a defensible position. For rhetorical analysis, it analyzes the writer’s rhetorical choices. For argument, it takes a defensible position rather than restating the issue or merely listing pros and cons. |
| **B. Evidence and Commentary** |    0–4 | Specific evidence plus explanation of how the evidence supports the student’s line of reasoning. The exact row rules differ for synthesis, rhetorical analysis, and argument.                                                                                                          |
| **C. Sophistication**          |    0–1 | Sophistication of thought and/or complex understanding of the rhetorical situation. It must be part of the argument/analysis, not a decorative phrase or isolated reference.                                                                                                           |

#### Synthesis Row B

The College Board rubric sets the levels as follows:

- **0:** merely restates the thesis, repeats provided information, or references fewer than two sources;
- **1:** uses/references at least two sources but mostly summarizes without explaining support;
- **2:** uses at least three sources and explains some relation to the argument, but does not establish a sound line of reasoning or does so faultily;
- **3:** uses specific evidence from at least three sources to support all claims in a line of reasoning and explains how some evidence supports it; and
- **4:** does the same with consistent explanation of how the evidence supports the line of reasoning.

The 2025 scoring guide and chief reader report emphasize that source count alone is insufficient. A response can mention three sources and still remain at 1 or 2 if it summarizes, uses generalities, or fails to connect evidence to claims. Strong responses tend to integrate source material into body paragraphs, use specific details, and explain how sources interact with the thesis.

#### Rhetorical Analysis Row B

The rubric sets the levels as follows:

- **0:** merely restates the thesis, repeats the passage, or offers irrelevant information;
- **1:** provides mostly general evidence and summarizes it without explaining support;
- **2:** provides some specific relevant evidence and explains some relation to the argument, but no sound line of reasoning is established or the line is faulty;
- **3:** provides specific evidence for all claims in a line of reasoning, explains some support, and explains how at least one rhetorical choice contributes to the writer’s argument, purpose, or message; and
- **4:** consistently supports the line of reasoning and explains how multiple rhetorical choices contribute to the writer’s argument, purpose, or message.

The fourth point is not a “device count” point. The rubric and chief-reader materials focus on the function of choices in the passage and the relationship between evidence and interpretation. Grammatical or mechanical errors that interfere with communication prevent the Row B fourth point.

#### Argument Row B

The rubric sets the levels as follows:

- **0:** merely restates the thesis, repeats the prompt, or gives irrelevant information;
- **1:** gives mostly general evidence and summarizes without explaining support;
- **2:** gives some specific, relevant evidence and explains some relation to the argument, but fails to establish a sound line of reasoning or establishes a faulty one;
- **3:** gives specific evidence to support all claims in a line of reasoning and explains how some evidence supports it; and
- **4:** does that consistently, with each supporting claim backed by adequately explained evidence.

The argument rubric does not require three provided sources because there are no provided source sets in this task. It still requires evidence and commentary, not unsupported opinion.

#### Sophistication Row C

The rubric’s one sophistication point is not awarded merely for long sentences, advanced vocabulary, mentioning “both sides,” or inserting a generic context sentence. Official scoring notes describe qualifying work as, depending on the task:

- a nuanced argument that consistently identifies and explores complexities or tensions;
- implications or limitations situated in a broader context;
- effective rhetorical choices that strengthen the student’s argument;
- a consistently vivid and persuasive style;
- explanation of the significance/relevance of rhetorical choices given the rhetorical situation; or
- explanation of the purpose/function of complexities or tensions in the passage.

The College Board explicitly lists sweeping generalizations, vague allusions to other arguments, and ineffective “complex” language as non-qualifying patterns.

### English generation and grading requirements for this repository

The current `argument-analysis` profile is too broad. It should become three task families:

```text
english-language-synthesis
english-language-rhetorical-analysis
english-language-argument
```

For synthesis, the question object needs a source-set model rather than generic `materials[]`. It should validate exactly six sources, two visual sources, at least one quantitative source, source labels, source descriptions, and a minimum of three usable sources. It should also store a rubric-specific accepted-evidence map that identifies which source details can support which claims without forcing one “correct” thesis.

For rhetorical analysis, the private rubric should encode rhetorical situation and the function of choices. A rubric criterion such as “identifies imagery” is not enough. It needs an evidence requirement, a function/effect requirement, and a connection to the writer’s purpose/message.

For argument, the rubric should accept multiple defensible positions. The reference answer should describe possible reasoning paths and evidence classes, not assert a single required opinion. It should also treat qualification and counterargument as possible sophistication evidence, not mandatory formulaic moves.

For all three essay types, the grader should separately evaluate thesis, evidence/commentary, and sophistication. It should not average criterion-level “quality” descriptions into an invented holistic score.

## Course-by-course implementation gap assessment

This section is an inference from the repository profile and schema compared with the official sources above.

### Current profile fields that are too generic

The current profile schema exposes only:

- one `formatId` per course;
- broad supported-format tags;
- minimum/maximum section counts;
- maximum material count;
- text-only response type; and
- one generation and one grading guidance string.

That shape cannot express the official differences without embedding a large amount of hidden conditional logic in prompts and graders. The highest-value schema change is not “add more prose to `generationGuidance`”; it is to add typed task profiles and rubric rules.

### Suggested canonical task metadata

```ts
type FrqTaskProfile = {
	course: 'AP Biology' | 'AP Calculus AB' | 'AP English Language';
	taskType: string;
	examSection: 'FRQ';
	maxPoints: number;
	recommendedMinutes?: number;
	calculator?: 'required' | 'not-permitted' | 'allowed' | 'not-applicable';
	stimulusRequirements: {
		minMaterials: number;
		maxMaterials: number;
		visualCount?: number;
		quantitativeVisualRequired?: boolean;
		passageWordRange?: { min: number; max: number };
	};
	parts: Array<{
		id: string;
		taskVerb: string;
		maxPoints: number;
		responseKind: 'text' | 'equation' | 'calculation' | 'graph' | 'model' | 'essay';
		rubricRules: unknown;
	}>;
};
```

This is illustrative, not an instruction to implement it in this research-only task. The key idea is that official task requirements should be data, so generation, validation, and grading can all consume the same source of truth.

### Question-level versioning

Every generated question should retain:

- College Board format family/version used as the design reference;
- application task-profile version;
- prompt-generation version;
- rubric version;
- response-mode version;
- question type; and
- the exact maximum-point total.

An old generated Biology question should not silently acquire the English rubric or a new graph requirement after a profile update. The current repository already has `profileVersion`, `promptVersion`, `rubricVersion`, and `schemaVersion`; the research supports keeping those fields and making them genuinely task-specific.

## What is known, what is not, and what should not be guessed

### Known from public official material

- All three supported courses have stable published FRQ counts and timing.
- Biology has six named task families and a stable 9/9/4/4/4/4 point structure.
- Calculus AB has six 9-point FRQs split into calculator and no-calculator parts, with explicit method and justification scoring.
- English Language has three stable essay categories, each scored 0–6 with thesis, evidence/commentary, and sophistication rows.
- College Board publishes recent released prompts, scoring guides, chief reader reports, and sample responses through AP Central.

### Not publicly available in the same way at research time

- Public 2026 scoring guidelines, chief reader reports, scoring statistics, and sample responses were not linked on the 2026 sections of the three AP Central past-question pages when this report was written. The 2026 prompt PDFs are available and were used for format confirmation only.
- College Board’s public pages do not provide a single machine-readable JSON schema for acceptable FRQ answers. The application must encode its own structured rubric representation from the official human-readable scoring guides.
- The official public materials do not prescribe a universal word count for English Language essays. Do not add one as an “official requirement.”
- The official materials do not prescribe one fixed number of subparts for every generated practice task beyond the published exam question formats. Practice questions can vary internally, but the generator should preserve the official family’s stimulus, skill, point, and response requirements.

### Do not infer from inaccessible or secure AP Classroom material

Earlier released questions may be available to authorized teachers inside AP Classroom, but they should not be recreated from memory or scraped from unofficial copies. Use the public AP Central materials for public format calibration and original content for the app’s practice bank.

## Recommended validation checklist before FRQs are considered accurate

### Biology

- [ ] Question type is one of the six official families.
- [ ] Point total is 9 for a long question or 4 for a short question.
- [ ] Stimulus includes the required experiment, data, model, or visual representation.
- [ ] Every part’s command verb matches the skill being scored.
- [ ] Controls, independent/dependent variables, hypotheses, and predictions are scientifically coherent.
- [ ] Graph/model requirements are explicit and gradeable.
- [ ] Rubric accepts scientifically equivalent claims but requires the requested evidence/mechanism.
- [ ] At least one test checks that a definition alone does not earn an application/justification point.

### Calculus AB

- [ ] Question is assigned to calculator-required or non-calculator Part A/B correctly.
- [ ] Each question totals exactly 9 points.
- [ ] Every numerical task specifies units and rounding expectations where relevant.
- [ ] Setup, method, answer, interpretation, and justification points are separated.
- [ ] The rubric contains eligibility/dependency rules and alternate valid methods.
- [ ] The task uses standard mathematical notation and does not rely on calculator syntax.
- [ ] Theorem tasks require hypotheses/conditions and the conclusion, not a theorem name alone.
- [ ] Global extrema tasks require a global argument, not only a local sign observation.

### English Language

- [ ] Task type is Synthesis, Rhetorical Analysis, or Argument.
- [ ] Synthesis has six related sources, two visual sources, and at least one quantitative source.
- [ ] Synthesis requires material from at least three sources and supports multiple defensible positions.
- [ ] Rhetorical Analysis has an original nonfiction passage of approximately 600–800 words and a clear rhetorical situation.
- [ ] Argument has a debatable claim or quotation and permits multiple positions/evidence paths.
- [ ] Each essay uses the 0–1 / 0–4 / 0–1 rubric rows appropriate to its type.
- [ ] Evidence and commentary are not collapsed into source/device counting.
- [ ] Sophistication is not awarded for vocabulary, generic context, or a named counterargument alone.
- [ ] Grammar/mechanics only affect the rubric where the official scoring notes say communication interference limits the point.

## Primary-source index

The course-by-course tables above provide the direct source links used for the findings. The most important permanent entry points are:

- [AP Biology exam and past questions](https://apcentral.collegeboard.org/courses/ap-biology/exam) and [AP Biology released-question index](https://apcentral.collegeboard.org/courses/ap-biology/exam/past-exam-questions)
- [AP Calculus AB exam and past questions](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam) and [AP Calculus AB released-question index](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam/past-exam-questions)
- [AP English Language exam and past questions](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam) and [AP English Language released-question index](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam/past-exam-questions)

These indexes should be rechecked before changing task profiles because College Board periodically updates CEDs, exam pages, and public release coverage.

## Addendum: AP Chemistry, AP Physics 1, AP Calculus BC, and AP Computer Science A

**Addendum research date:** 2026-08-15  
**Scope:** This addendum extends the existing report with four additional courses requested for FRQ accuracy work.  
**Source policy:** All factual claims below are based on official College Board materials hosted on AP Central. Implementation recommendations are explicitly labeled as inferences from those materials and from the repository's current generic FRQ model.

### Cross-course version warning for the addendum

The 2026 public releases are not equally useful for scoring calibration. AP Central currently exposes 2026 question PDFs for all four courses, but the public 2026 rows do not yet expose the corresponding scoring guidelines, chief-reader reports, or scored student samples for these courses. The effective CEDs and the 2025 scoring materials therefore provide the most detailed public scoring evidence, while the 2026 question PDFs confirm the current prompt layout and task families.

Two transitions require special care:

- **AP Physics 1:** the 2024–25 course and exam revision means the public 2025 and earlier releases do not completely align with the current exam. The effective CED and current exam page are authoritative for the current four-task blueprint; 2025 chief-reader observations are useful only for recurring skill errors that still match the named task families.
- **AP Computer Science A:** the 2025–26 course and exam revision means the public 2025 and earlier materials do not completely align with the current exam. The effective Fall 2025 CED and the 2026 prompt are authoritative for the current four-question structure. Older scoring guides and chief-reader reports should be used as historical evidence about rubric granularity, not as the current question blueprint.

College Board's public past-question pages also state that only the three most recent years are publicly available; older secure material is in AP Classroom for authorized educators. The repository should not reconstruct secure questions or copy public prompts into the practice bank.

## AP Chemistry

### Official source and version record

| Source                                                                                                                                                                                                              | Version/date note                                                                                       | What it establishes                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry)                                                                                                                                 | Current AP Central page reviewed 2026-08-15                                                             | Current course framework and CED entry point                                                                                         |
| [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam)                                                                                                                              | Current page reviewed 2026-08-15; page displays the 2027 administration                                 | Current section counts, timing, weights, long/short split, calculator and reference-material policies                                |
| [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf)                                                                               | Effective Fall 2024, V.1                                                                                | Six science practices, task verbs, exam blueprint, unit weights, sample FRQs, and sample scoring guidelines                          |
| [2026 AP Chemistry Free-Response Questions](https://apcentral.collegeboard.org/media/pdf/ap26-frq-chemistry.pdf)                                                                                                    | 2026 public release; no public 2026 scoring links were shown on the past-question page at research time | Current prompt directions, long/short layout, optional pacing, calculator/reference access, and current stimulus patterns            |
| [2025 AP Chemistry Scoring Guidelines](https://apcentral.collegeboard.org/media/pdf/ap25-sg-chemistry.pdf)                                                                                                          | 2025 release                                                                                            | Point-by-point criteria, acceptable alternatives, numerical tolerances, significant-figure requirements, and diagram/equation credit |
| [2025 AP Chemistry Chief Reader Report](https://apcentral.collegeboard.org/media/pdf/ap25-cr-report-chemistry.pdf)                                                                                                  | 2025 release                                                                                            | Question purposes, point performance, common misconceptions, and recurring evidence/reasoning failures                               |
| [2025 Chemistry sample responses and commentary, FRQ 1](https://apcentral.collegeboard.org/media/pdf/ap25-apc-chemistry-q1.pdf) and [FRQ 2](https://apcentral.collegeboard.org/media/pdf/ap25-apc-chemistry-q2.pdf) | 2025 release; AP Central links samples for all seven questions                                          | Official scored student work and commentary                                                                                          |
| [AP Chemistry past exam questions and scoring information](https://apcentral.collegeboard.org/courses/ap-chemistry/exam/past-exam-questions)                                                                        | Current AP Central index                                                                                | Public 2023–2026 question, scoring, chief-reader, statistics, and sample-response links                                              |

### Exam-level FRQ format

The current AP Chemistry exam page and the 2026 released paper establish the following format:

- Section II has **7 free-response questions**.
- The section lasts **1 hour 45 minutes** and is **50% of the exam score**.
- Questions 1–3 are **long-answer questions worth 10 points each**.
- Questions 4–7 are **short-answer questions worth 4 points each**.
- The section therefore contains **46 raw FRQ points** before the exam's overall weighting.
- A four-function, scientific, or graphing calculator is allowed, and reference information including the periodic table and equations/constants is available.
- The 2026 directions recommend about 23 minutes per long question and 9 minutes per short question, but students may move between questions until time expires.
- The exam assesses all six course science practices: **Models and Representations; Question and Method; Representing Data and Phenomena; Model Analysis; Mathematical Routines; and Argumentation**.

These are official facts. The 46-point total is an arithmetic consequence of the published 3 x 10 plus 4 x 4 structure, not a separate College Board claim about the composite score.

### Official task families and recurring Chemistry response patterns

Unlike Biology, AP Chemistry does not publish six fixed FRQ question labels that map one-to-one to Questions 1–7. It publishes a stable long/short structure and says that all six science practices are assessed. The following families are therefore divided between official named practices and recurring tasks visible in the CED, the 2025 scoring guide, and the 2026 release.

| Family                              | Official basis                                                           | Typical stimulus and response                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Models and representations**      | Science Practice 1; CED task verbs                                       | Lewis or particulate diagrams, molecular geometry, electron configurations, resonance, electrochemical or equilibrium representations, and equations. Students may need to draw, annotate, complete, or write a representation.                |
| **Question and method**             | Science Practice 2                                                       | Experimental setup, measurement procedure, control/variable selection, completion criteria, uncertainty reduction, or a method for obtaining a chemical quantity.                                                                              |
| **Representing data and phenomena** | Science Practice 3                                                       | Tables, graphs, spectra, titration curves, energy diagrams, reaction progress, or a requested plot/annotation. Students describe patterns, calculate from data, or construct a representation.                                                 |
| **Model analysis**                  | Science Practice 4                                                       | Explain a chemical property or macroscopic observation from a particulate model; evaluate whether a model is consistent with chemical theory; connect particulate-level behavior to a macroscopic result.                                      |
| **Mathematical routines**           | Science Practice 5                                                       | Stoichiometry, pH/pOH, dilution, thermochemistry, kinetics, equilibrium, Ksp/Q, gas laws, electrochemistry, rate constants, or related calculations. Work and units are part of the response, not optional scratch work.                       |
| **Argumentation**                   | Science Practice 6                                                       | Make a claim about a chemical system or experiment and support it with data, a chemical principle, a calculation, or a causal explanation. “Justify” generally requires more than naming a principle.                                          |
| **Mixed long-answer investigation** | Recurring format in released exams; not a separately named official type | A single chemical context carries several parts across representation, calculation, explanation, prediction, and evidence. The 2026 KCl calorimetry/solubility question and the 2025 magnesium hydroxide question show this mixed progression. |

The generator should choose a primary family for metadata, but it should allow a long question to combine several practices. Treating every Chemistry FRQ as a generic essay or as one isolated calculation would lose the intended progression from model or data to reasoning and argument.

### Prompt, stimulus, and response requirements

Official Chemistry prompts commonly supply enough information to make the chemical system self-contained. A generated task should be able to include:

- a chemical phenomenon, reaction, substance, or experimental situation;
- equations, structural or particulate diagrams, tables, spectra, graphs, or reference values;
- variables, initial conditions, units, and enough data for a determinate calculation;
- questions that progress from identifying or representing to calculating, explaining, predicting, and justifying;
- explicit requests for a diagram, graph, equation, numerical result, sign, units, or significant figures; and
- a response location or typed answer type that makes the requested representation gradeable.

The 2026 directions require work to be shown for calculations and say that significant figures matter. The 2026 questions also include drawn Lewis/particulate representations, graph annotations, net ionic equations, calculations, and written justifications. A text-only textarea can collect prose, but it cannot faithfully represent every official response mode.

The CED's task verbs include **calculate**, **describe**, **determine**, **draw**, **explain**, **identify**, **justify**, **predict**, **represent/draw/write an equation/complete a diagram**, and related wording. A Chemistry generator should preserve the requested verb because “identify,” “describe,” “explain,” and “justify” imply different evidence burdens.

### Chemistry scoring and rubric mechanics

The official scoring guides use criterion-level, usually one-point decisions. They are not holistic 0–4 or essay-level rubrics. A long or short question is decomposed into individually scorable parts, often with separate points for:

- a correct representation or equation;
- a correct setup or method;
- a numerical result;
- correct units, sign, or significant figures;
- a justification tied to a chemical law, model, or data;
- a prediction consistent with the preceding calculation or model; and
- a data-supported conclusion.

The 2025 Chemistry scoring guide shows several important behaviors:

- Numerical results may have an acceptable range, such as a pKa interval.
- A correct answer can receive credit when shown with an alternate valid method or equivalent expression.
- A result can be eligible for a later point when it is consistent with an earlier incorrect value, depending on the question's scoring note.
- A diagram point can require a precise relationship, not merely a chemically related drawing.
- A justification point can require both the direction of a change and the mechanism that produces it.
- Calculations can require the sign and significant figures in addition to the magnitude.

### Common Chemistry scoring pitfalls

The 2025 Chief Reader Report and scoring guide identify recurring errors that should become explicit grader tests:

- stating that an ion is “more attracted” without identifying the relevant charge or distance in Coulombic reasoning;
- treating a control as a label without explaining its purpose;
- using the wrong post-dilution volume or failing to conserve moles;
- including solids or liquids in an equilibrium expression when they should be omitted;
- comparing a reaction quotient to the wrong equilibrium constant or using an unadjusted concentration;
- giving a numerical answer without the required work, units, sign, or significant figures;
- describing a graph trend without connecting it to the requested rate law or mechanism;
- giving a correct chemical term without applying it to the provided system; and
- making a prediction without evidence and chemical reasoning.

These are findings from official scoring material. The recommendation to turn each into an automated regression case is an implementation inference.

### Chemistry implementation implications for this repository

The existing generic `AP Biology`/`AP Calculus AB`/`AP English Language` profile shape cannot express Chemistry accurately. A future Chemistry profile should include at least:

```text
chemistry-long-mixed
chemistry-short-model-representation
chemistry-short-data-analysis
chemistry-short-mathematical-routine
chemistry-short-argumentation
chemistry-experimental-method
```

Those labels are proposed application labels, not College Board labels. The implementation should also store:

- long/short role and exact maximum points;
- course skill(s) and learning objectives covered;
- required material kinds such as spectrum, graph, table, equation, molecular/particulate diagram, or experimental procedure;
- response kinds such as `text`, `number`, `equation`, `diagram`, `graph`, and `calculation-with-work`;
- numerical tolerances, units, sign, significant-figure, and alternate-method rules;
- acceptable chemical claims and the evidence/mechanism required for each point; and
- profile, prompt, rubric, and response-mode versions.

If the product deliberately accepts a text or LaTeX representation in place of drawing, the question should say so in the practice UI and the result should be marked as an approximation rather than an official digital-equivalent response.

## AP Physics 1: Algebra-Based

### Official source and version record

| Source                                                                                                                                                                                                              | Version/date note                                                                                            | What it establishes                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| [AP Physics 1 course page](https://apcentral.collegeboard.org/courses/ap-physics-1)                                                                                                                                 | Current AP Central page reviewed 2026-08-15                                                                  | Current course framework and effective CED entry point                                                                          |
| [AP Physics 1 exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam)                                                                                                                              | Current page reviewed 2026-08-15; explicitly announces 2027 MCQ updates                                      | Current hybrid-digital format, FRQ count/timing, four named FRQ types, calculator policy, and transition warning                |
| [AP Physics 1 Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf)                                                                               | Effective current CED, V.1, © 2026                                                                           | Eight-unit framework, unit weights, four FRQ types, task verbs, current sample questions, and current sample scoring guidelines |
| [2026 AP Physics 1 Free-Response Questions](https://apcentral.collegeboard.org/media/pdf/ap26-frq-physics-1.pdf)                                                                                                    | 2026 public release; no public scoring links were shown on the past-question page at research time           | Current prompt directions, graph/diagram requirements, pacing, and examples of all four current task families                   |
| [2025 AP Physics 1 Scoring Guidelines](https://apcentral.collegeboard.org/media/pdf/ap25-sg-physics-1.pdf)                                                                                                          | 2025 release; AP Central warns that 2025 and earlier materials do not completely align with the current exam | Point-level scoring behavior and representative criteria for the same named task families                                       |
| [2025 AP Physics 1 Chief Reader Report](https://apcentral.collegeboard.org/media/pdf/ap25-cr-report-physics-1.pdf)                                                                                                  | 2025 release; use as legacy/task-skill evidence only                                                         | Common errors in mathematical routines, representation translation, experimental design, and qualitative/quantitative reasoning |
| [2025 Physics 1 sample responses and commentary, FRQ 1](https://apcentral.collegeboard.org/media/pdf/ap25-apc-physics-1-q1.pdf) and [FRQ 2](https://apcentral.collegeboard.org/media/pdf/ap25-apc-physics-1-q2.pdf) | 2025 release                                                                                                 | Official scored examples for the legacy-but-related task families                                                               |
| [AP Physics 1 past exam questions and scoring information](https://apcentral.collegeboard.org/courses/ap-physics-1/exam/past-exam-questions)                                                                        | Current AP Central index                                                                                     | Public releases and the explicit 2024–25 revision warning                                                                       |

### Exam-level FRQ format

The current exam page and effective CED establish:

- Section II has **4 free-response questions**.
- Section II lasts **95 minutes** and is **50% of the exam score**.
- The four questions are one each of **Mathematical Routines**, **Translation Between Representations**, **Experimental Design and Analysis**, and **Qualitative/Quantitative Translation**.
- A four-function, scientific, or graphing calculator is allowed on both sections.
- The current exam page describes a hybrid digital exam: students view questions in Bluebook and handwrite FRQ answers in paper booklets.
- The effective CED assigns the multiple-choice section across eight units: Kinematics 10–15%; Force and Translational Dynamics 18–23%; Work, Energy, and Power 18–23%; Linear Momentum 10–15%; Torque and Rotational Dynamics 10–15%; Energy and Momentum of Rotating Systems 5–8%; Oscillations 5–8%; and Fluids 10–15%.
- The current page separately announces a May 2027 update to the multiple-choice count and timing. The FRQ count and 95-minute section described above are the current published FRQ format.

The 2026 directions recommend approximately 25 minutes for Questions 1 and 3, 30 minutes for Question 2, and 20 minutes for Question 4. Students must show work, include units when applicable, and clearly designate work for each part. A ruler and straightedge are permitted in the released digital-format instructions.

### Four official Physics 1 FRQ types

| Official type                            | Current task shape                                                                                                                                                    | Response/stimulus requirements                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mathematical Routines**                | Apply a physical principle or law to derive a symbolic expression, calculate a quantity, or analyze a physical situation.                                             | Often begins with a diagram or scenario; derivations should begin with a fundamental principle or reference equation. Correct force/energy/momentum diagrams, algebraic steps, and final expressions can each be separate points.                                                                         |
| **Translation Between Representations**  | Translate among words, diagrams, graphs, bar charts, equations, and physical models.                                                                                  | May require constructing or interpreting a graph/bar chart/diagram, then explaining consistency between representations. A later justification may remain eligible even if an earlier representation is incorrect when the reasoning is internally consistent, as shown in the current CED scoring guide. |
| **Experimental Design and Analysis**     | Design a procedure, identify measurable quantities, reduce uncertainty, linearize data, construct a graph, use a slope/intercept, and calculate a physical parameter. | Requires experimental variables, a repeatable method, uncertainty reasoning, axis labels/units, plotted data, best-fit line, and interpretation of graph features. The 2026 release includes a coefficient-of-friction investigation.                                                                     |
| **Qualitative/Quantitative Translation** | Make a qualitative prediction, derive a quantitative relationship, and reconcile the equation with the original qualitative reasoning.                                | The prompt explicitly expects qualitative reasoning beyond merely citing equations, followed by a derivation and a consistency check. The 2026 release uses a collision and a rotational-dynamics comparison.                                                                                             |

These four labels are official. The physical topic changes by administration; the current CED and 2026 release show kinematics, momentum, fluids, friction, and rotational dynamics as examples rather than a fixed Q1–Q4 content list.

### Physics response and stimulus design

An accurate Physics 1 task should be built around a physical system with explicit boundaries, variables, initial conditions, and representations. Stimuli can include:

- physical diagrams, free-body diagrams, momentum-vector diagrams, or apparatus sketches;
- tables of measured values and a prompt to select or transform axes for a linear graph;
- graphs that represent position, velocity, energy, or another physical quantity;
- a reference equation or an instruction to begin from a fundamental principle;
- experimental limitations and available equipment;
- a request for a symbolic derivation, numerical value, qualitative comparison, or justification; and
- units and a clear indication of which part is being answered.

The 2026 directions emphasize that credit depends on the physical principle selected and the quality of the explanation. A numerical answer alone is not an adequate response type for most multi-part tasks.

### Physics scoring mechanics

The current CED includes sample scoring guidelines for the four named tasks. Its sample point structure is:

| Question family                      | Current CED sample points |
| ------------------------------------ | ------------------------: |
| Mathematical Routines                |                        10 |
| Translation Between Representations  |                        12 |
| Experimental Design and Analysis     |                        10 |
| Qualitative/Quantitative Translation |                         8 |
| **Total in the CED sample**          |                    **40** |

This is the point structure of the CED's illustrative sample scoring set. Because public 2026 scoring information is not yet linked, the application should store the point total as part of the release/profile version instead of assuming every future form has exactly the same distribution.

The scoring is criterion-level and method-sensitive. The current CED sample guidelines award separate points for items such as:

- a correctly labeled force or vector diagram;
- a net-force or torque expression;
- use of Newton's laws, energy, momentum, or another appropriate principle;
- a multi-step derivation and correct symbolic result;
- graph choice, axis labels, scale, plotted points, and best-fit line;
- calculating a slope or parameter from the graph with units;
- a procedure that measures the necessary quantities and reduces uncertainty;
- a qualitative claim and a physical explanation beyond equation citation; and
- consistency between a quantitative derivation and the qualitative prediction.

The 2025 scoring guide also illustrates that rubric credit can be banked across methods, with later work sometimes earning a point when it is consistent with an earlier imported result. It is not safe to grade only the final numerical answer.

### Common Physics 1 scoring pitfalls

The official 2025 Chief Reader Report and scoring guidelines, with the current-format caveat above, identify reusable pitfalls:

- drawing a representation with an unlabeled or physically incorrect vector/force;
- citing conservation of energy or momentum without defining the system or connecting the principle to the claim;
- deriving an expression without starting from a valid fundamental equation when the prompt requires it;
- giving a qualitative answer that only repeats an equation rather than explaining the physical relationship;
- choosing graph axes that are not linearizable or failing to include units and a numerical scale;
- plotting points or a best-fit line inconsistently with the stated transformation;
- measuring an insufficient set of quantities or failing to reduce uncertainty in an experimental design;
- confusing slope, intercept, or the physical quantity represented by a graph feature; and
- failing to make the final equation consistent with an earlier approximation or limiting-case argument.

These are official scoring observations. Converting them into criterion-level tests and deterministic graph checks is an implementation inference.

### Physics 1 implementation implications for this repository

The repository needs a Physics-specific response model, not a `text` section with a generic rubric. Proposed application task IDs are:

```text
physics1-mathematical-routines
physics1-translation-representations
physics1-experimental-design-analysis
physics1-qualitative-quantitative-translation
```

Each task should declare:

- a system and relevant physical quantities;
- calculator and reference-sheet policy;
- required diagrams, graphs, equations, or tables;
- response kinds such as `text`, `equation`, `number-with-units`, `diagram`, `graph`, and `derivation`;
- a rubric dependency graph for method, answer, representation, and justification points;
- tolerance/units rules for numerical answers; and
- the course unit, science practice, and learning objective tags.

For graphing tasks, a structured answer object should capture axis variables, scale, units, points, and best-fit line. For derivations, the answer should preserve the student's intermediate expressions so the grader can distinguish a wrong final value from a missing physical principle. If the UI remains text-only, it should collect an explicit text/LaTeX approximation and avoid representing it as equivalent to the official graph or diagram response.

## AP Calculus BC

### Official source and version record

| Source                                                                                                                                                                                                                    | Version/date note                                                                                       | What it establishes                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc)                                                                                                                                   | Current AP Central page reviewed 2026-08-15                                                             | Current course and CED entry point                                                                                                       |
| [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam)                                                                                                                                | Current page reviewed 2026-08-15; announces 2026–27 clarifications and May 2027 MCQ changes             | Current FRQ count, timing, calculator split, representations, and transition notes                                                       |
| [AP Calculus AB and BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-and-bc-course-and-exam-description.pdf)                                                                   | Current hosted CED; effective content framework includes 10 BC units                                    | Common/BC-only FRQ structure, unit weights, practice weights, task verbs, and scoring conventions                                        |
| [2026 AP Calculus BC Free-Response Questions](https://apcentral.collegeboard.org/media/pdf/ap26-frq-calculus-bc.pdf)                                                                                                      | 2026 public release; no public 2026 scoring links were shown on the past-question page at research time | Current calculator directions, notation requirements, and representative common/BC-only tasks                                            |
| [2025 AP Calculus BC Scoring Guidelines](https://apcentral.collegeboard.org/media/pdf/ap25-sg-calculus-bc.pdf)                                                                                                            | 2025 release                                                                                            | Nine-point question rubrics, calculator/non-calculator rules, method credit, dependencies, units, rounding, and BC-only scoring examples |
| [2025 AP Calculus AB/BC Chief Reader Report](https://apcentral.collegeboard.org/media/pdf/ap25-cr-report-calculus-ab-bc.pdf)                                                                                              | 2025 release                                                                                            | Common and BC-only task patterns, misconceptions, and scoring observations                                                               |
| [2025 Calculus BC sample responses and commentary, FRQ 1](https://apcentral.collegeboard.org/media/pdf/ap25-apc-calculus-bc-q1.pdf) and [FRQ 2](https://apcentral.collegeboard.org/media/pdf/ap25-apc-calculus-bc-q2.pdf) | 2025 release                                                                                            | Official scored student work and commentary                                                                                              |
| [AP Calculus BC past exam questions and scoring information](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam/past-exam-questions)                                                                          | Current AP Central index                                                                                | Public question, scoring, chief-reader, statistics, subscore, and sample-response links                                                  |

### Exam-level FRQ format

The current AP Calculus BC page and CED establish:

- Section II has **6 free-response questions**, worth **50% of the exam score**.
- The section lasts **1 hour 30 minutes**.
- Part A has **2 questions in 30 minutes** with a graphing calculator required.
- Part B has **4 questions in 60 minutes** with a graphing calculator not permitted.
- Each FRQ is worth **9 points**, so the section has **54 raw FRQ points**.
- BC and AB share **three common FRQs** assessing content from the AB domain. The other three BC questions assess BC-only content in addition to the common calculus skills.
- The exam includes various function types and analytical, graphical, tabular, and verbal representations; the FRQ section has a roughly equal procedural/conceptual mix and at least two real-world contexts.
- The current CED assigns the BC multiple-choice unit ranges as: Units 1–4 each 5–10%; Unit 5 10–15%; Unit 6 15–20%; Unit 7 5–10%; Unit 8 5–10%; Unit 9, Parametric Equations, Polar Coordinates, and Vector-Valued Functions, 10–15%; and Unit 10, Infinite Sequences and Series, 15–20%.

The current BC page says the CED has minor clarifications for 2026–27 and that the MCQ count/timing changes begin in May 2027. The FRQ structure remains six questions with the calculator split above.

### Official and recurring BC FRQ families

College Board does not assign one permanent named topic to each of the six BC questions. The stable structure is three common AB tasks plus three BC-only tasks. The generator should use the following family metadata:

| Family                                     | Official basis and recurring content                                                                                                                                                                              | Typical response requirements                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Common AB calculus task**                | The three shared questions draw from limits/continuity, differentiation, applications of derivatives, integration/accumulation, differential equations, applications of integration, and related representations. | Multi-part work with setup, answer, units, interpretation, theorem/test justification, graph/table reading, or a real-world model.                            |
| **Parametric and vector-valued functions** | BC-only Unit 9 family. Released questions may ask for derivatives, tangent slopes, motion/position, speed, area, or accumulation using parametric/vector representations.                                         | Correct derivative relationships, chain-rule structure, interpretation of a parameter, setup for area or rate, and calculator setup when in Part A.           |
| **Polar functions**                        | BC-only Unit 9 family. Released questions may ask for polar area, slope, arc-related quantities, average distance, or critical points.                                                                            | Polar formulas and bounds, appropriate (r^2) area integrand, derivative conversion, interval reasoning, setup, and final approximation.                       |
| **Infinite sequences and series**          | BC-only Unit 10 family. Released questions may ask for convergence tests, intervals/radii, Taylor/Maclaurin polynomials or series, error bounds, Euler's method, or representing a function with a power series.  | Correct test or theorem conditions, first terms/general term, interval endpoints, error-bound reasoning, and standard notation.                               |
| **Representation and context translation** | Cross-cutting official FRQ expectation, not a separate question label.                                                                                                                                            | Translate among a formula, graph, table, verbal description, rate, accumulation, or contextual quantity; include units and an interpretation where requested. |
| **Justification and verification**         | Cross-cutting Mathematical Practice 3 and the task verbs “explain,” “justify,” and “verify.”                                                                                                                      | State the relevant theorem/definition/test, verify its conditions, apply it, and connect the conclusion to the prompt.                                        |

The 2025 BC release demonstrates the range: polar area and derivative work in calculator Part A; a table-based accumulation/context question in a common task; differential equations and graph analysis without a calculator; and BC-only Taylor/series work. These examples are recurring families, not a promise that every administration uses the same order or exact topic combination.

### Calculus response and stimulus requirements

Every generated BC FRQ should declare its calculator mode before generation. The official directions require:

- standard mathematical notation rather than calculator syntax;
- supporting work even when a calculator performs a derivative, integral, root, or numerical calculation;
- a clearly shown equation, function, or integral setup for calculator-assisted results;
- final decimal answers accurate to three places after the decimal point unless otherwise specified;
- units for contextual quantities when applicable; and
- verification of theorem, definition, or test conditions for justifications.

Stimuli should support the official representation mix: formulas, tables, graphs, rates, functions, and verbal/contextual descriptions. A question may use a table of values, a derivative graph, a polar curve, a slope field, a parametric model, or a power-series representation.

### Calculus BC scoring mechanics and pitfalls

The 2025 scoring guidelines show a criterion-level **9-point rubric for every question**. Common criterion types include:

- setup or equation;
- method/process;
- correct numerical or symbolic answer;
- units or contextual interpretation;
- theorem/definition condition;
- reason or justification;
- representation-specific components; and
- later points that can be earned using a consistent value imported from an earlier error.

The scoring guide is explicit about eligibility. For example, a final point may require an earlier method point, while another explanation point may be earned with a consistent imported result. The grader must therefore model dependencies rather than score the final answer in isolation.

Chief-reader and scoring-guide pitfalls include:

- giving a calculator result without the mathematical setup;
- using calculator syntax instead of standard notation;
- failing to state units or rounding incorrectly;
- invoking the Intermediate Value Theorem, Extreme Value Theorem, Mean Value Theorem, a convergence test, or a derivative test without checking the conditions;
- using (r) instead of (r^2) in a polar-area setup;
- confusing average rate of change with average value;
- treating a local sign observation as a complete global-extrema justification;
- giving a Taylor or power-series answer without the required terms, general term, interval, or error reasoning; and
- introducing extra candidate points or intervals that invalidate an otherwise correct claim under the question-specific scoring note.

These rules are official scoring behavior. A typed rubric engine that records setup, process, result, condition, and interpretation separately is an implementation inference.

### Calculus BC implementation implications for this repository

BC should not be treated as an alias for AB. A future profile should preserve the shared AB task infrastructure while adding BC-only generators:

```text
calculus-bc-common
calculus-bc-parametric-vector
calculus-bc-polar
calculus-bc-series
```

The proposed labels are repository labels, not official College Board question names. Each question should store:

- `calculatorPolicy` and part/section role;
- exact 9-point total and criterion dependencies;
- function representation and context type;
- BC unit/topic coverage, especially Unit 9 versus Unit 10;
- expected setup, method, units, rounding, and justification requirements; and
- accepted alternate methods and consistent-answer propagation rules.

For a full practice test, the metadata should require three AB-common slots and three BC-specific slots, not merely six random questions from the combined unit bank.

## AP Computer Science A

### Official source and version record

| Source                                                                                                                                                         | Version/date note                                                                                            | What it establishes                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [AP Computer Science A course page](https://apcentral.collegeboard.org/courses/ap-computer-science-a)                                                          | Current page reviewed 2026-08-15; CED revised for 2025–26                                                    | Current four-unit framework and computational-thinking practices                                                              |
| [AP Computer Science A exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam)                                                       | Current page reviewed 2026-08-15                                                                             | Fully digital delivery, Java Quick Reference, current FRQ count/timing, question families, and point totals                   |
| [AP Computer Science A Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description.pdf)        | Effective Fall 2025, V.1                                                                                     | Current exam blueprint, all four FRQ descriptions, units/practices, task verbs, sample prompts, and sample scoring guidelines |
| [2026 AP Computer Science A Free-Response Questions](https://apcentral.collegeboard.org/media/pdf/ap26-frq-computer-science-a.pdf)                             | 2026 public release; no public 2026 scoring links were shown on the past-question page at research time      | Current digital directions, Java-only response requirement, reference assumptions, and current prompt structures              |
| [2025 AP Computer Science A Scoring Guidelines](https://apcentral.collegeboard.org/media/pdf/ap25-sg-computer-science-a.pdf)                                   | 2025 release; AP Central warns that 2025 and earlier materials do not completely align with the current exam | Detailed point-level coding criteria and decision/penalty rules for legacy but closely related tasks                          |
| [2025 AP Computer Science A Chief Reader Report](https://apcentral.collegeboard.org/media/pdf/ap25-cr-report-computer-science-a.pdf)                           | 2025 release; use for recurring coding misconceptions with the revision caveat                               | Common implementation errors, method/array/string pitfalls, and advice from scoring readers                                   |
| [2025 CSA sample responses and commentary, FRQ 1](https://apcentral.collegeboard.org/media/pdf/ap25-apc-computer-science-a-q1.pdf)                             | 2025 release                                                                                                 | Official scored code samples and commentary for a legacy-format question                                                      |
| [AP Computer Science A past exam questions and scoring information](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam/past-exam-questions) | Current AP Central index                                                                                     | Public 2026 prompt, older scoring/sample files, and explicit revision warning                                                 |

### Exam-level FRQ format

The current exam page and effective Fall 2025 CED establish:

- Section II has **4 free-response questions**.
- Section II lasts **1 hour 30 minutes** and is **45% of the exam score**.
- The current CED assigns **7 points** to Question 1, **7 points** to Question 2, **5 points** to Question 3, and **6 points** to Question 4, for **25 raw FRQ points**.
- All FRQs assess Computational Thinking Practice 2, **Develop Code**. Across the four questions, the three skills within that practice are assessed.
- The exam is fully digital, and students submit their code in Bluebook. All program segments must be written in **Java**.
- The Java Quick Reference is available during the exam. Unless a prompt says otherwise, parameters are assumed non-null and method preconditions are assumed satisfied.
- The current multiple-choice framework covers four units: Using Objects and Methods 15–25%; Selection and Iteration 25–35%; Class Creation 10–18%; and Data Collections 30–40%. Those percentages describe the multiple-choice section, not a promise that each FRQ has a fixed unit percentage.

### Four official CSA FRQ types

| Question | Official type and points                     | Required task shape                                                                                                                                                                                                                    |
| -------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**    | **Methods and Control Structures, 7 points** | Write two methods or one constructor and one method in a provided class. Part A is 4 points and requires iteration/conditionals and method calls; Part B is 3 points and requires String methods.                                      |
| **2**    | **Class Design, 7 points**                   | Design and implement a class from a scenario, specifications, and examples. The response generally needs the class header, private instance variables, constructor, required method header(s), and method/constructor implementations. |
| **3**    | **Data Analysis with ArrayList, 5 points**   | Write one method that uses, analyzes, and manipulates data in an ArrayList and associated class(es). Current CED language makes this the ArrayList-focused data task.                                                                  |
| **4**    | **2D Array, 6 points**                       | Write one method that uses, analyzes, and manipulates a two-dimensional array and associated class(es).                                                                                                                                |

These named families are stable in the effective CED and current exam page. The underlying scenario changes, and the prompt may combine method calls, conditionals, loops, strings, object creation, indexing, and algorithmic accumulation within a family.

### Prompt, stimulus, and code-response requirements

CSA FRQs are not essay prompts with a prose rubric. They are specification-driven programming tasks. A generated task should include:

- a Java class or partial class definition;
- method/constructor signatures and required return types;
- field declarations or instructions to create them;
- preconditions, postconditions, and assumptions;
- examples or a table of code-execution sequences and return values;
- helper methods and the allowed Java API surface where relevant;
- a clear statement of whether the student must write a constructor, method, class, ArrayList algorithm, or 2D-array algorithm; and
- a code editor response with syntax-preserving text, not a plain prose textarea.

The 2026 directions also say that significant code that could be replaced by an accessible Java Quick Reference method will not receive full credit, and that annotations are not scored as code. A practice UI should distinguish code from explanations and should preserve the exact class/method context supplied to the student.

### CSA scoring mechanics

The current CED's sample scoring guidelines and the recent public scoring guides use point-by-point criteria tied to observable program behavior. Criteria can separately award points for:

- class and method headers;
- private instance variables and initialization;
- correct calls to helper or instance methods;
- accessing all required elements without bounds errors;
- conditionals and inclusive/exclusive loop boundaries;
- constructing objects and adding them to collections;
- maintaining and updating an accumulator;
- returning a value of the correct type in all required cases; and
- implementing the complete algorithm.

Alternative valid algorithms can earn credit. The current CED sample explicitly accepts multiple ways of iterating through a String. The 2025 public scoring guide also has global decision rules for legacy forms, including limited penalty handling for array/collection access confusion, destructive side effects, undeclared local variables, returning from void methods/constructors, and extraneous code with side effects. Because the public 2025 guide is not fully current, any penalty rules used by the application must be tied to the current release/profile version rather than copied blindly.

### Common CSA scoring pitfalls

Official chief-reader and scoring materials repeatedly identify these errors:

- calling an instance method without the required object reference or with the wrong parameter;
- calling a state-changing helper method more than once and accidentally changing the result;
- failing to return a value in every required branch, or printing instead of returning;
- using `==` to compare String contents instead of an appropriate String method;
- using incorrect inclusive/exclusive substring indices;
- missing an inclusive end boundary in a loop;
- confusing array indexing with ArrayList access;
- using `size` where `length` is required or vice versa;
- accessing the wrong 2D-array row/column order or going out of bounds;
- failing to handle odd/even or other explicitly stated special cases;
- forgetting to initialize an accumulator or assigning instead of accumulating; and
- writing a class, constructor, or method signature that does not match the specification.

These findings support deterministic syntax/structure checks and hidden behavioral tests. The recommendation to use both is an implementation inference, not a College Board requirement for this repository.

### CSA implementation implications for this repository

CSA requires a different answer architecture from the current FRQ schema. Proposed application task IDs are:

```text
csa-methods-control
csa-class-design
csa-arraylist-data-analysis
csa-two-dimensional-array
```

The generated question should store:

- Java starter code and the exact editable region(s);
- class, constructor, and method signatures;
- field types, preconditions, postconditions, and examples;
- allowed reference methods/API assumptions;
- hidden test cases or a deterministic execution harness;
- criterion-level rubric rules for headers, accesses, control flow, algorithms, and return behavior;
- current CED/profile version and release-year scoring version; and
- a code response, not a `text` response that is later interpreted by an LLM.

The safest grader architecture is a deterministic Java compiler/interpreter or restricted execution harness for behavioral checks, combined with a rubric layer for criteria that require code-structure interpretation. An LLM can explain failures or map evidence to criteria, but it should not be the sole authority for whether code compiles, accesses the right collection, returns the right value, or satisfies a hidden test. This is an implementation inference from the criterion-level scoring model.

## Addendum-wide implementation summary

These four courses make the central schema conclusion even stronger: FRQs are not one universal `prompt + text sections + AI-generated rubric` product. The application needs a versioned task-profile catalog in which generation, response validation, grading, and full-test assembly read the same official-format metadata.

At minimum, the catalog should support:

| Course                | Required response families                                                               | High-value deterministic checks                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| AP Chemistry          | Text, calculation, equation, diagram, graph, particulate/model representation            | Units, sign, significant figures, numerical tolerance, equilibrium expressions, graph/diagram components, evidence/mechanism requirements  |
| AP Physics 1          | Text, derivation, number-with-units, diagram, graph, experimental plan                   | Units, slope/intercept, axis/point rules, physical-principle selection, qualitative/quantitative consistency, uncertainty design           |
| AP Calculus BC        | Equation, calculation, graph/table interpretation, justification, contextual explanation | Calculator-mode enforcement, setup, method, theorem conditions, units, rounding, eligibility/consistent-answer propagation, BC-only topics |
| AP Computer Science A | Java code, class/method structure, collection/array algorithm                            | Compilation, signatures, bounds, method calls, control flow, state mutation, return behavior, hidden tests, rubric exceptions              |

### 2026 public-material limitations

- The 2026 question PDFs are public for all four courses and were used to confirm current format and prompt behavior.
- The public 2026 past-question rows did not expose scoring guidelines, chief-reader reports, scoring statistics, or sample-response links for these courses at research time. Do not manufacture 2026-specific rubric rules from the prompt alone.
- AP Physics 1 public 2025 and earlier scoring materials are explicitly marked by College Board as not completely aligned with the current revised exam.
- AP Computer Science A public 2025 and earlier scoring materials are explicitly marked as not completely aligned with the current revised exam.
- The effective CED sample scoring guidelines are the strongest current public rubric reference for Physics 1 and CSA, but they are sample scoring guides and should still be stored with their CED/version metadata.
- Public AP Central releases are not a complete substitute for secure AP Classroom material. Use them for format, scoring vocabulary, and misconception calibration; generate wholly original practice stimuli and code scenarios.

### Primary-source index for the addendum

- [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam), [AP Chemistry CED](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf), and [AP Chemistry past-question index](https://apcentral.collegeboard.org/courses/ap-chemistry/exam/past-exam-questions)
- [AP Physics 1 exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam), [AP Physics 1 CED](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf), and [AP Physics 1 past-question index](https://apcentral.collegeboard.org/courses/ap-physics-1/exam/past-exam-questions)
- [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam), [AP Calculus AB/BC CED](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-and-bc-course-and-exam-description.pdf), and [AP Calculus BC past-question index](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam/past-exam-questions)
- [AP Computer Science A exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam), [AP CSA effective Fall 2025 CED](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description.pdf), and [AP CSA past-question index](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam/past-exam-questions)

The four sections above are research findings. The proposed task IDs, typed response kinds, deterministic validators, and catalog shape are implementation inferences for Free AP Practice and should be treated as design requirements to validate during the implementation phase.
