# AP exam, course, unit, and question-bank research

Snapshot date: **2026-08-21**<br>
Artifact: `src/lib/data/ap-classes-data-08212026.json`<br>
Schema: `2.0.0`<br>
Research boundary: current AP courses supported by Free AP Practice, with official College Board sources accessed on 2026-08-21.

## Executive summary

This report consolidates the current app catalog and the source-backed AP assessment research into one auditable snapshot. It covers **25 courses**, **179 app units**, **204 practice pages**, **560 app topic entries**, and **794 app keyword entries**. The dataset contains **94 source records** and deliberately contains no generated question instances or user data. The former standalone app data files are now represented as typed sections of this unified artifact.

The artifact keeps three layers separate:

- **Official AP layer:** College Board course pages, Course and Exam Descriptions, exam pages, calculator/reference policies, revision notices, and released-assessment indexes.
- **App layer:** the exact course/unit labels, semester placement, practice-page content, app-authored generation controls, MCQ prompt contract, FRQ profiles, and pool targets currently used by Free AP Practice.
- **Runtime storage layer:** the Neon PostgreSQL JSONB schemas and metadata contracts used for generated MCQs and FRQs. The generated rows remain in the database and are described, not copied, here.

### Reading the unit records

The report intentionally omits unit descriptions, topic lists, and focus keywords from the public research artifact. Runtime generation uses only app-authored controls; official course and assessment claims remain linked to their source IDs. Use the linked CED for exhaustive learning objectives and essential knowledge statements.

## Repository audit and consolidation map

| Unified dataset section                                                            | What the unified artifact provides                                                                               |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `courses[].units[].app.semester`                                                   | Exact current course names, semester placement, unit labels, order, and app unit count.                          |
| `courses[].generation` and `courses[].units[].generation.mcq`                      | App-authored course and unit generation controls.                                                                |
| `pages[]` plus page IDs under `courses[].app.practice` and `courses[].units[].app` | Class/unit SEO records, article paragraphs, links, and page slugs under each course/unit.                        |
| `questionBank.mcq.poolRules`                                                       | MCQ target configuration and FRQ pool target.                                                                    |
| `src/lib/question-bank/mcq/generation.server.ts`                                   | MCQ schema, strict unit-scope rules, originality rules, output contract, and generation controls.                |
| `src/lib/question-bank/frq/types.ts`                                               | FRQ schema version, materials/sections/rubric structure, limits, and validation rules.                           |
| `src/lib/question-bank/frq/profiles.server.ts`                                     | The three currently enabled app FRQ profiles and explicit disabled status for the other courses.                 |
| `src/lib/server/neon/schema/content.ts`                                            | Neon tables, JSONB payload locations, and the distinction between content rows and this static catalog artifact. |
| `src/lib/ap-knowledge/catalog.ts`                                                  | Explicit alignment records for AP Physics 2, AP Statistics, and AP Spanish Language catalog overrides.           |

## Cross-course official exam rules

- Multiple-choice scoring is based on correct responses; free-response and performance work use course-specific criteria; component results are combined into a 1–5 AP score through College Board scoring processes. See [AP Exam Timing and Structure](https://apstudents.collegeboard.org/ap-exams-what-to-know/exam-timing-structure); [How AP Exams Are Scored](https://apstudents.collegeboard.org/help-center/how-are-ap-exams-scored); [AP Exam Development](https://apcentral.collegeboard.org/courses/how-ap-develops-courses-and-exams/exam-development); [AP Course and Exam Changes](https://apcentral.collegeboard.org/courses/how-ap-develops-courses-and-exams/course-changes-overview); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information); [Past AP Exam Questions](https://apcentral.collegeboard.org/courses/past-exam-questions).
- Hybrid exams use Bluebook for the digital portion and paper booklets for handwritten free responses. Fully digital exams submit all documented responses in Bluebook. The app records delivery mode per course rather than assuming one format for every AP exam.
- Calculator permissions are course-specific. Section-specific mathematics rules are stored on exam parts where applicable. Students must follow the current [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy), including its restrictions on phones, smartwatches, QWERTY devices, wireless-enabled devices, and camera-capable devices.
- Course-specific equation sheets, tables, Java references, and other materials are represented in each exam record and should be checked against [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information) before student-facing copy is generated.
- [Past AP Exam Questions](https://apcentral.collegeboard.org/courses/past-exam-questions) was used for format and scoring research only. No released AP question, passage, rubric text, or answer key is reproduced in the JSON or this report.

## Exam-format matrix

| Course                         | App units | Official framework units | Delivery                                  | Section I                                                            | Section II / through-course component                                                                                                       | App FRQ                                   |
| ------------------------------ | --------: | -----------------------: | ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| AP Biology                     |         8 |                        8 | hybrid-digital                            | Section I: Multiple Choice: 60 questions; 90 min; 50%                | Section II: Free Response: 6 questions; 90 min; 50%                                                                                         | enabled (ap-biology-frq-profile)          |
| AP Chemistry                   |         9 |                        9 | hybrid-digital                            | Section I: Multiple Choice: 60 questions; 90 min; 50%                | Section II: Free Response: 7 questions; 105 min; 50%                                                                                        | disabled in the current app               |
| AP Physics 1                   |         8 |                        8 | hybrid-digital                            | Section I: Multiple Choice: 42 questions; 85 min; 50%                | Section II: Free Response: 4 questions; 95 min; 50%                                                                                         | disabled in the current app               |
| AP Physics 2                   |         7 |                        7 | hybrid-digital                            | Section I: Multiple Choice: 42 questions; 85 min; 50%                | Section II: Free Response: 4 questions; 95 min; 50%                                                                                         | disabled in the current app               |
| AP Physics C: Mechanics        |         7 |                        7 | hybrid-digital                            | Section I: Multiple Choice: 42 questions; 85 min; 50%                | Section II: Free Response: 4 questions; 95 min; 50%                                                                                         | disabled in the current app               |
| AP Physics C: E&M              |         6 |                        6 | hybrid-digital                            | Section I: Multiple Choice: 42 questions; 85 min; 50%                | Section II: Free Response: 4 questions; 95 min; 50%                                                                                         | disabled in the current app               |
| AP Environmental Science       |         9 |                        9 | fully-digital                             | Section I: Multiple Choice: 80 questions; 90 min; 60%                | Section II: Free Response: 3 questions; 70 min; 40%                                                                                         | disabled in the current app               |
| AP Calculus AB                 |         8 |                        8 | hybrid-digital                            | Section I: Multiple Choice: 42 questions; 100 min; 50%               | Section II: Free Response: 6 questions; 90 min; 50%                                                                                         | enabled (ap-calculus-ab-frq-profile)      |
| AP Calculus BC                 |        10 |                       10 | hybrid-digital                            | Section I: Multiple Choice: 42 questions; 100 min; 50%               | Section II: Free Response: 6 questions; 90 min; 50%                                                                                         | disabled in the current app               |
| AP Statistics                  |         9 |                        5 | fully-digital                             | Section I: Multiple Choice: 42 questions; 90 min; 50%                | Section II: Free Response: 4 questions; 90 min; 50%                                                                                         | disabled in the current app               |
| AP Precalculus                 |         4 |                        4 | hybrid-digital                            | Section I: Multiple Choice: 42 questions; 105 min; 62.5%             | Section II: Free Response: 4 questions; 70 min; 37.5%                                                                                       | disabled in the current app               |
| AP Computer Science A          |         4 |                        4 | fully-digital                             | Section I: Multiple Choice: 42 questions; 90 min; 55%                | Section II: Free Response: 4 questions; 90 min; 45%                                                                                         | disabled in the current app               |
| AP Computer Science Principles |         5 |                        5 | fully-digital-plus-through-course-task    | Section I: End-of-Course Multiple Choice: 70 questions; 120 min; 70% | Create Performance Task: through-course task; separate deadline; 30%<br>Create-Related Written Responses: 2 questions; 60 min; part of task | disabled in the current app               |
| AP English Language            |         9 |                        9 | fully-digital                             | Section I: Multiple Choice: 45 questions; 60 min; 45%                | Section II: Free Response: 3 questions; 135 min; 55%                                                                                        | enabled (ap-english-language-frq-profile) |
| AP English Literature          |         9 |                        9 | fully-digital                             | Section I: Multiple Choice: 55 questions; 60 min; 45%                | Section II: Free Response: 3 questions; 120 min; 55%                                                                                        | disabled in the current app               |
| AP US History                  |         9 |                        9 | fully-digital                             | Section I, Part A: Multiple Choice: 55 questions; 55 min; 40%        | Section I, Part B: Short Answer: 3 questions; 40 min; 20%<br>Section II: Document-Based Question and Long Essay: 2 questions; 100 min; 40%  | disabled in the current app               |
| AP World History               |         9 |                        9 | fully-digital                             | Section I, Part A: Multiple Choice: 55 questions; 55 min; 40%        | Section I, Part B: Short Answer: 3 questions; 40 min; 20%<br>Section II: Document-Based Question and Long Essay: 2 questions; 100 min; 40%  | disabled in the current app               |
| AP European History            |         9 |                        9 | fully-digital                             | Section I, Part A: Multiple Choice: 55 questions; 55 min; 40%        | Section I, Part B: Short Answer: 3 questions; 40 min; 20%<br>Section II: Document-Based Question and Long Essay: 2 questions; 100 min; 40%  | disabled in the current app               |
| AP US Government               |         5 |                        5 | fully-digital                             | Section I: Multiple Choice: 55 questions; 80 min; 50%                | Section II: Free Response: 4 questions; 100 min; 50%                                                                                        | disabled in the current app               |
| AP Comparative Government      |         5 |                        5 | fully-digital                             | Section I: Multiple Choice: 55 questions; 60 min; 50%                | Section II: Free Response: 4 questions; 90 min; 50%                                                                                         | disabled in the current app               |
| AP Psychology                  |         5 |                        5 | fully-digital                             | Section I: Multiple Choice: 75 questions; 90 min; 66.7%              | Section II: Free Response: 2 questions; 70 min; 33.3%                                                                                       | disabled in the current app               |
| AP Human Geography             |         7 |                        7 | fully-digital                             | Section I: Multiple Choice: 60 questions; 60 min; 50%                | Section II: Free Response: 3 questions; 75 min; 50%                                                                                         | disabled in the current app               |
| AP Macroeconomics              |         6 |                        6 | hybrid-digital                            | Section I: Multiple Choice: 60 questions; 70 min; 66%                | Section II: Free Response: 3 questions; 60 min; 33%                                                                                         | disabled in the current app               |
| AP Microeconomics              |         6 |                        6 | hybrid-digital                            | Section I: Multiple Choice: 60 questions; 70 min; 66%                | Section II: Free Response: 3 questions; 60 min; 33%                                                                                         | disabled in the current app               |
| AP Spanish Language            |         6 |                        6 | fully-digital-plus-through-course-project | Section I: Free Response: 3 questions; 65–70 min; 50%                | Section II: Multiple Choice: 55 questions; 80 min; 50%                                                                                      | disabled in the current app               |

## Course-by-course research

Each course section below includes the current app unit inventory, official exam structure, skills, revision notes, and source links. Generation prompts use app-authored controls that are intentionally not reproduced here.

### AP Biology

**Official name:** AP Biology<br>
**Category:** science<br>
**Current app units:** 8<br>
**Official framework units in this snapshot:** 8<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** enabled (ap-biology-frq-profile)

Official framework labels: Unit 1: Chemistry of Life; Unit 2: Cells; Unit 3: Cellular Energetics; Unit 4: Cell Communication and Cell Cycle; Unit 5: Heredity; Unit 6: Gene Expression and Regulation; Unit 7: Natural Selection; Unit 8: Ecology.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: concept explanation; visual representations; questions and methods; representing and describing data; statistical tests and data analysis; argumentation.
Official sources: [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology); [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam); [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 180 minutes. Calculator policy: permitted.

- **Section I: Multiple Choice** - 60 questions; 90 minutes; 50% of the exam score.
- Question/task types: discrete; stimulus-set.
- Note: Stimulus sets typically contain 4–5 related questions.
- **Section II: Free Response** - 6 questions; 90 minutes; 50% of the exam score.
- Question/task types: long-experimental-analysis; long-experimental-analysis-with-graphing; short-scientific-investigation; short-conceptual-analysis; short-model-or-visual-analysis; short-data-analysis.
- Note: Two long questions are worth 9 points each; four short questions are worth 4 points each.
  Reference materials: course-specific reference information.
- Assessment note: Students view the exam in Bluebook and handwrite free-response answers in paper booklets.

#### Current app units and source context

##### Unit 1: Chemistry of Life

- **Stable ID:** `ap-biology-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Chemistry of Life
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-biology/unit-1`
- **App page’s published multiple-choice weight range:** 8%–11%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology); [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam); [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Cells

- **Stable ID:** `ap-biology-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Cells
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-biology/unit-2`
- **App page’s published multiple-choice weight range:** 10%–13%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology); [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam); [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Cellular Energetics

- **Stable ID:** `ap-biology-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Cellular Energetics
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-biology/unit-3`
- **App page’s published multiple-choice weight range:** 12%–16%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology); [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam); [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Cell Communication and Cell Cycle

- **Stable ID:** `ap-biology-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Cell Communication and Cell Cycle
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-biology/unit-4`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology); [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam); [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Heredity

- **Stable ID:** `ap-biology-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Heredity
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-biology/unit-5`
- **App page’s published multiple-choice weight range:** 8%–11%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology); [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam); [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Gene Expression and Regulation

- **Stable ID:** `ap-biology-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Gene Expression and Regulation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-biology/unit-6`
- **App page’s published multiple-choice weight range:** 12%–16%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology); [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam); [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Natural Selection

- **Stable ID:** `ap-biology-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Natural Selection
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-biology/unit-7`
- **App page’s published multiple-choice weight range:** 13%–20%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology); [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam); [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Ecology

- **Stable ID:** `ap-biology-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: Ecology
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-biology/unit-8`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology); [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam); [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Chemistry

**Official name:** AP Chemistry<br>
**Category:** science<br>
**Current app units:** 9<br>
**Official framework units in this snapshot:** 9<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Atomic Structure and Properties; Unit 2: Compound Structure and Properties; Unit 3: Properties of Substances and Mixtures; Unit 4: Chemical Reactions; Unit 5: Kinetics; Unit 6: Thermochemistry; Unit 7: Equilibrium; Unit 8: Acids and Bases; Unit 9: Thermodynamics and Electrochemistry.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: models and representations; question and method; representing data and phenomena; model analysis; mathematical routines; argumentation.
Official sources: [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry); [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam); [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 195 minutes. Calculator policy: permitted.

- **Section I: Multiple Choice** - 60 questions; 90 minutes; 50% of the exam score.
- Question/task types: discrete; stimulus-set.
- **Section II: Free Response** - 7 questions; 105 minutes; 50% of the exam score.
- Question/task types: long-answer; short-answer.
- Note: Three long-answer questions are worth 10 points each; four short-answer questions are worth 4 points each.
  Reference materials: course-specific reference information.
- Assessment note: Students view the exam in Bluebook and handwrite free-response answers in paper booklets.

#### Current app units and source context

##### Unit 1: Atomic Structure and Properties

- **Stable ID:** `ap-chemistry-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Atomic Structure and Properties
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-chemistry/unit-1`
- **App page’s published multiple-choice weight range:** 7%–9%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry); [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam); [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Compound Structure and Properties

- **Stable ID:** `ap-chemistry-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Compound Structure and Properties
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-chemistry/unit-2`
- **App page’s published multiple-choice weight range:** 7%–9%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry); [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam); [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Properties of Substances and Mixtures

- **Stable ID:** `ap-chemistry-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Properties of Substances and Mixtures
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-chemistry/unit-3`
- **App page’s published multiple-choice weight range:** 18%–22%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry); [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam); [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Chemical Reactions

- **Stable ID:** `ap-chemistry-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Chemical Reactions
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-chemistry/unit-4`
- **App page’s published multiple-choice weight range:** 7%–9%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry); [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam); [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Kinetics

- **Stable ID:** `ap-chemistry-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Kinetics
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-chemistry/unit-5`
- **App page’s published multiple-choice weight range:** 7%–9%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry); [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam); [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Thermochemistry

- **Stable ID:** `ap-chemistry-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Thermochemistry
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-chemistry/unit-6`
- **App page’s published multiple-choice weight range:** 7%–9%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry); [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam); [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Equilibrium

- **Stable ID:** `ap-chemistry-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Equilibrium
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-chemistry/unit-7`
- **App page’s published multiple-choice weight range:** 7%–9%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry); [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam); [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Acids and Bases

- **Stable ID:** `ap-chemistry-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: Acids and Bases
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-chemistry/unit-8`
- **App page’s published multiple-choice weight range:** 11%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry); [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam); [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 9: Thermodynamics and Electrochemistry

- **Stable ID:** `ap-chemistry-unit-9`
- **Semester:** 2
- **Official canonical label:** Unit 9: Thermodynamics and Electrochemistry
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-chemistry/unit-9`
- **App page’s published multiple-choice weight range:** 7%–9%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry); [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam); [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Physics 1

**Official name:** AP Physics 1: Algebra-Based<br>
**Category:** science<br>
**Current app units:** 8<br>
**Official framework units in this snapshot:** 8<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Kinematics; Unit 2: Force and Translational Dynamics; Unit 3: Work, Energy, and Power; Unit 4: Linear Momentum; Unit 5: Torque and Rotational Dynamics; Unit 6: Energy and Momentum of Rotating Systems; Unit 7: Oscillations; Unit 8: Fluids.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: creating representations; mathematical routines; scientific questioning and argumentation.
Official sources: [AP Physics 1: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-1); [AP Physics 1: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam); [AP Physics 1: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 180 minutes. Calculator policy: permitted.

- **Section I: Multiple Choice** - 42 questions; 85 minutes; 50% of the exam score.
- Question/task types: discrete; stimulus-set.
- **Section II: Free Response** - 4 questions; 95 minutes; 50% of the exam score.
- Question/task types: mathematical-routines; translation-between-representations; experimental-design-and-analysis; qualitative-quantitative-translation.
  Reference materials: equation sheet and reference information.
- Assessment note: The 42-question/85-minute multiple-choice and 95-minute free-response structure is effective beginning with the May 2027 exam.
- 2026–27 update: Exam updates are published for the May 2027 administration.

#### Current app units and source context

##### Unit 1: Kinematics

- **Stable ID:** `ap-physics-1-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Kinematics
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-1/unit-1`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 1: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-1); [AP Physics 1: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam); [AP Physics 1: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Force and Translational Dynamics

- **Stable ID:** `ap-physics-1-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Force and Translational Dynamics
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-1/unit-2`
- **App page’s published multiple-choice weight range:** 18%–23%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 1: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-1); [AP Physics 1: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam); [AP Physics 1: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Work, Energy, and Power

- **Stable ID:** `ap-physics-1-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Work, Energy, and Power
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-1/unit-3`
- **App page’s published multiple-choice weight range:** 18%–23%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 1: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-1); [AP Physics 1: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam); [AP Physics 1: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Linear Momentum

- **Stable ID:** `ap-physics-1-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Linear Momentum
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-1/unit-4`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 1: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-1); [AP Physics 1: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam); [AP Physics 1: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Torque and Rotational Dynamics

- **Stable ID:** `ap-physics-1-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Torque and Rotational Dynamics
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-1/unit-5`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 1: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-1); [AP Physics 1: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam); [AP Physics 1: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Energy and Momentum of Rotating Systems

- **Stable ID:** `ap-physics-1-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Energy and Momentum of Rotating Systems
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-1/unit-6`
- **App page’s published multiple-choice weight range:** 5%–8%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 1: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-1); [AP Physics 1: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam); [AP Physics 1: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Oscillations

- **Stable ID:** `ap-physics-1-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Oscillations
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-1/unit-7`
- **App page’s published multiple-choice weight range:** 5%–8%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 1: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-1); [AP Physics 1: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam); [AP Physics 1: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Fluids

- **Stable ID:** `ap-physics-1-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: Fluids
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-1/unit-8`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 1: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-1); [AP Physics 1: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam); [AP Physics 1: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Physics 2

**Official name:** AP Physics 2: Algebra-Based<br>
**Category:** science<br>
**Current app units:** 7<br>
**Official framework units in this snapshot:** 7<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 9: Thermodynamics; Unit 10: Electric Force, Field, and Potential; Unit 11: Electric Circuits; Unit 12: Magnetism and Electromagnetism; Unit 13: Geometric Optics; Unit 14: Waves, Sound, and Physical Optics; Unit 15: Modern Physics.
Official framework alignment: official-current-framework-differs-from-app-base-catalog.
Skills: creating representations; mathematical routines; scientific questioning and argumentation.
Official sources: [AP Physics 2: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-2); [AP Physics 2: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-2/exam); [AP Physics 2: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-2-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 180 minutes. Calculator policy: permitted.

- **Section I: Multiple Choice** - 42 questions; 85 minutes; 50% of the exam score.
- Question/task types: discrete; stimulus-set.
- **Section II: Free Response** - 4 questions; 95 minutes; 50% of the exam score.
- Question/task types: mathematical-routines; translation-between-representations; experimental-design-and-analysis; qualitative-quantitative-translation.
  Reference materials: equation sheet and reference information.
- Assessment note: The 42-question/85-minute multiple-choice and 95-minute free-response structure is effective beginning with the May 2027 exam.
- 2026–27 update: The CED contains minor course-convention clarifications for 2026–27.

#### Current app units and source context

##### Unit 9: Thermodynamics

- **Stable ID:** `ap-physics-2-unit-9`
- **Semester:** 1
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-2/unit-9`
- **App page’s published multiple-choice weight range:** 15%–18%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 2: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-2); [AP Physics 2: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-2/exam); [AP Physics 2: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-2-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 10: Electric Force, Field, and Potential

- **Stable ID:** `ap-physics-2-unit-10`
- **Semester:** 1
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-2/unit-10`
- **App page’s published multiple-choice weight range:** 15%–18%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 2: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-2); [AP Physics 2: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-2/exam); [AP Physics 2: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-2-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 11: Electric Circuits

- **Stable ID:** `ap-physics-2-unit-11`
- **Semester:** 1
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-2/unit-11`
- **App page’s published multiple-choice weight range:** 15%–18%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 2: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-2); [AP Physics 2: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-2/exam); [AP Physics 2: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-2-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 12: Magnetism and Electromagnetism

- **Stable ID:** `ap-physics-2-unit-12`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-2/unit-12`
- **App page’s published multiple-choice weight range:** 12%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 2: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-2); [AP Physics 2: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-2/exam); [AP Physics 2: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-2-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 13: Electromagnetic Induction

- **Stable ID:** `ap-physics-2-unit-13`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-2/unit-13`
- **App page’s published multiple-choice weight range:** 12%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 2: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-2); [AP Physics 2: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-2/exam); [AP Physics 2: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-2-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 14: Geometric Optics

- **Stable ID:** `ap-physics-2-unit-14`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-2/unit-14`
- **App page’s published multiple-choice weight range:** 12%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 2: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-2); [AP Physics 2: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-2/exam); [AP Physics 2: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-2-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 15: Waves, Sound, and Physical Optics

- **Stable ID:** `ap-physics-2-unit-15`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-2/unit-15`
- **App page’s published multiple-choice weight range:** 12%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics 2: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-2); [AP Physics 2: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-2/exam); [AP Physics 2: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-2-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Physics C: Mechanics

**Official name:** AP Physics C: Mechanics<br>
**Category:** science<br>
**Current app units:** 7<br>
**Official framework units in this snapshot:** 7<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Kinematics; Unit 2: Force and Translational Dynamics; Unit 3: Work, Energy, and Power; Unit 4: Linear Momentum; Unit 5: Torque and Rotational Dynamics; Unit 6: Energy and Momentum of Rotating Systems; Unit 7: Oscillations.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: mathematical modeling; physical representations; experimental design and analysis; qualitative and quantitative translation.
Official sources: [AP Physics C: Mechanics course page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics); [AP Physics C: Mechanics exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam); [AP Physics C: Mechanics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-mechanics-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 180 minutes. Calculator policy: permitted.

- **Section I: Multiple Choice** - 42 questions; 85 minutes; 50% of the exam score.
- Question/task types: discrete; stimulus-set.
- **Section II: Free Response** - 4 questions; 95 minutes; 50% of the exam score.
- Question/task types: mathematical-routines; translation-between-representations; experimental-design-and-analysis; qualitative-quantitative-translation.
  Reference materials: equation sheet and reference information.
- Assessment note: The 2027 structure is effective beginning with the May 2027 exam.
- 2026–27 update: Exam updates are published for the May 2027 administration.

#### Current app units and source context

##### Unit 1: Kinematics

- **Stable ID:** `ap-physics-c-mechanics-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Kinematics
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-c-mechanics/unit-1`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Mechanics course page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics); [AP Physics C: Mechanics exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam); [AP Physics C: Mechanics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-mechanics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Force and Translational Dynamics

- **Stable ID:** `ap-physics-c-mechanics-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Force and Translational Dynamics
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-c-mechanics/unit-2`
- **App page’s published multiple-choice weight range:** 20%–25%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Mechanics course page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics); [AP Physics C: Mechanics exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam); [AP Physics C: Mechanics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-mechanics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Work, Energy, and Power

- **Stable ID:** `ap-physics-c-mechanics-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Work, Energy, and Power
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-c-mechanics/unit-3`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Mechanics course page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics); [AP Physics C: Mechanics exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam); [AP Physics C: Mechanics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-mechanics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Linear Momentum

- **Stable ID:** `ap-physics-c-mechanics-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Linear Momentum
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-c-mechanics/unit-4`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Mechanics course page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics); [AP Physics C: Mechanics exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam); [AP Physics C: Mechanics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-mechanics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Torque and Rotational Dynamics

- **Stable ID:** `ap-physics-c-mechanics-unit-5`
- **Semester:** 1
- **Official canonical label:** Unit 5: Torque and Rotational Dynamics
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-c-mechanics/unit-5`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Mechanics course page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics); [AP Physics C: Mechanics exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam); [AP Physics C: Mechanics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-mechanics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Energy and Momentum of Rotating Systems

- **Stable ID:** `ap-physics-c-mechanics-unit-6`
- **Semester:** 1
- **Official canonical label:** Unit 6: Energy and Momentum of Rotating Systems
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-c-mechanics/unit-6`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Mechanics course page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics); [AP Physics C: Mechanics exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam); [AP Physics C: Mechanics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-mechanics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Oscillations

- **Stable ID:** `ap-physics-c-mechanics-unit-7`
- **Semester:** 1
- **Official canonical label:** Unit 7: Oscillations
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-physics-c-mechanics/unit-7`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Mechanics course page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics); [AP Physics C: Mechanics exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam); [AP Physics C: Mechanics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-mechanics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Physics C: E&M

**Official name:** AP Physics C: Electricity and Magnetism<br>
**Category:** science<br>
**Current app units:** 6<br>
**Official framework units in this snapshot:** 6<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 8: Electric Charges, Fields, and Gauss's Law; Unit 9: Electric Potential; Unit 10: Conductors and Capacitors; Unit 11: Electric Circuits; Unit 12: Magnetic Fields and Electromagnetism; Unit 13: Electromagnetic Induction.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: mathematical modeling; physical representations; experimental design and analysis; qualitative and quantitative translation.
Official sources: [AP Physics C: Electricity and Magnetism course page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism); [AP Physics C: Electricity and Magnetism exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism/exam); [AP Physics C: Electricity and Magnetism Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-electricity-and-magnetism-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 180 minutes. Calculator policy: permitted.

- **Section I: Multiple Choice** - 42 questions; 85 minutes; 50% of the exam score.
- Question/task types: discrete; stimulus-set.
- **Section II: Free Response** - 4 questions; 95 minutes; 50% of the exam score.
- Question/task types: mathematical-routines; translation-between-representations; experimental-design-and-analysis; qualitative-quantitative-translation.
  Reference materials: equation sheet and reference information.
- Assessment note: The 2027 structure is effective beginning with the May 2027 exam.
- 2026–27 update: The CED contains minor course-convention clarifications for 2026–27.

#### Current app units and source context

##### Unit 8: Electric Charges, Fields, and Gauss's Law

- **Stable ID:** `ap-physics-c-eandm-unit-8`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-c-em/unit-8`
- **App page’s published multiple-choice weight range:** 15%–25%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Electricity and Magnetism course page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism); [AP Physics C: Electricity and Magnetism exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism/exam); [AP Physics C: Electricity and Magnetism Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-electricity-and-magnetism-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 9: Electric Potential

- **Stable ID:** `ap-physics-c-eandm-unit-9`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-c-em/unit-9`
- **App page’s published multiple-choice weight range:** 10%–20%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Electricity and Magnetism course page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism); [AP Physics C: Electricity and Magnetism exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism/exam); [AP Physics C: Electricity and Magnetism Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-electricity-and-magnetism-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 10: Conductors and Capacitors

- **Stable ID:** `ap-physics-c-eandm-unit-10`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-c-em/unit-10`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Electricity and Magnetism course page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism); [AP Physics C: Electricity and Magnetism exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism/exam); [AP Physics C: Electricity and Magnetism Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-electricity-and-magnetism-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 11: Electric Circuits

- **Stable ID:** `ap-physics-c-eandm-unit-11`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-c-em/unit-11`
- **App page’s published multiple-choice weight range:** 15%–25%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Electricity and Magnetism course page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism); [AP Physics C: Electricity and Magnetism exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism/exam); [AP Physics C: Electricity and Magnetism Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-electricity-and-magnetism-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 12: Magnetic Fields and Electromagnetism

- **Stable ID:** `ap-physics-c-eandm-unit-12`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-c-em/unit-12`
- **App page’s published multiple-choice weight range:** 10%–20%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Electricity and Magnetism course page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism); [AP Physics C: Electricity and Magnetism exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism/exam); [AP Physics C: Electricity and Magnetism Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-electricity-and-magnetism-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 13: Electromagnetic Induction

- **Stable ID:** `ap-physics-c-eandm-unit-13`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-physics-c-em/unit-13`
- **App page’s published multiple-choice weight range:** 10%–20%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Physics C: Electricity and Magnetism course page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism); [AP Physics C: Electricity and Magnetism exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism/exam); [AP Physics C: Electricity and Magnetism Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-electricity-and-magnetism-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Environmental Science

**Official name:** AP Environmental Science<br>
**Category:** science<br>
**Current app units:** 9<br>
**Official framework units in this snapshot:** 9<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: The Living World: Ecosystems; Unit 2: The Living World: Biodiversity; Unit 3: Populations; Unit 4: Earth Systems and Resources; Unit 5: Land and Water Use; Unit 6: Energy Resources and Consumption; Unit 7: Atmospheric Pollution; Unit 8: Aquatic and Terrestrial Pollution; Unit 9: Global Change.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: concept explanation; visual representations; text analysis; scientific experiments; data analysis; mathematical routines; environmental solutions.
Official sources: [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science); [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam); [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 160 minutes. Calculator policy: permitted.

- **Section I: Multiple Choice** - 80 questions; 90 minutes; 60% of the exam score.
- Question/task types: individual; quantitative-data-set; qualitative-data-set; text-source-set.
- **Section II: Free Response** - 3 questions; 70 minutes; 40% of the exam score.
- Question/task types: design-an-investigation; analyze-and-interpret-quantitative-data; analyze-an-environmental-problem-with-calculations.
  Reference materials: reference information in Bluebook.
- Assessment note: All responses are submitted in Bluebook.
- 2026–27 update: The 2026–27 clarification document says course content does not change.

#### Current app units and source context

##### Unit 1: The Living World: Ecosystems

- **Stable ID:** `ap-environmental-science-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: The Living World: Ecosystems
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-environmental-science/unit-1`
- **App page’s published multiple-choice weight range:** 6%–8%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science); [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam); [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: The Living World: Biodiversity

- **Stable ID:** `ap-environmental-science-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: The Living World: Biodiversity
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-environmental-science/unit-2`
- **App page’s published multiple-choice weight range:** 6%–8%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science); [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam); [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Populations

- **Stable ID:** `ap-environmental-science-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Populations
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-environmental-science/unit-3`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science); [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam); [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Earth Systems and Resources

- **Stable ID:** `ap-environmental-science-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Earth Systems and Resources
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-environmental-science/unit-4`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science); [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam); [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Land and Water Use

- **Stable ID:** `ap-environmental-science-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Land and Water Use
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-environmental-science/unit-5`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science); [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam); [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Energy Resources and Consumption

- **Stable ID:** `ap-environmental-science-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Energy Resources and Consumption
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-environmental-science/unit-6`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science); [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam); [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Atmospheric Pollution

- **Stable ID:** `ap-environmental-science-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Atmospheric Pollution
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-environmental-science/unit-7`
- **App page’s published multiple-choice weight range:** 7%–10%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science); [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam); [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Aquatic and Terrestrial Pollution

- **Stable ID:** `ap-environmental-science-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: Aquatic and Terrestrial Pollution
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-environmental-science/unit-8`
- **App page’s published multiple-choice weight range:** 7%–10%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science); [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam); [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 9: Global Change

- **Stable ID:** `ap-environmental-science-unit-9`
- **Semester:** 2
- **Official canonical label:** Unit 9: Global Change
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-environmental-science/unit-9`
- **App page’s published multiple-choice weight range:** 15%–20%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science); [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam); [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Calculus AB

**Official name:** AP Calculus AB<br>
**Category:** math<br>
**Current app units:** 8<br>
**Official framework units in this snapshot:** 8<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** enabled (ap-calculus-ab-frq-profile)

Official framework labels: Unit 1: Limits and Continuity; Unit 2: Differentiation: Definition and Fundamental Properties; Unit 3: Differentiation: Composite, Implicit, and Inverse Functions; Unit 4: Contextual Applications of Differentiation; Unit 5: Analytical Applications of Differentiation; Unit 6: Integration and Accumulation of Change; Unit 7: Differential Equations; Unit 8: Applications of Integration.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: mathematical processes; equivalent representations; justification and communication; modeling and interpretation.
Official sources: [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab); [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam); [AP Calculus AB Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 190 minutes. Calculator policy: permitted with section-specific restrictions.

- **Section I: Multiple Choice** - 42 questions; 100 minutes; 50% of the exam score.
- Question/task types: analytical; graphical; tabular; verbal.
- Part **A**: questionCount=29; durationMinutes=62; calculatorPolicy=not-permitted.
- Part **B**: questionCount=13; durationMinutes=38; calculatorPolicy=graphing-calculator-required.
- **Section II: Free Response** - 6 questions; 90 minutes; 50% of the exam score.
- Question/task types: procedural; conceptual; real-world-context.
- Part **A**: questionCount=2; durationMinutes=30; calculatorPolicy=graphing-calculator-required.
- Part **B**: questionCount=4; durationMinutes=60; calculatorPolicy=not-permitted.
  Reference materials: reference information in Bluebook.
- Assessment note: At least two free-response questions incorporate a real-world context or scenario.
- 2026–27 update: Minor 2026–27 clarifications; updated question count and timing effective May 2027.

#### Current app units and source context

##### Unit 1: Limits and Continuity

- **Stable ID:** `ap-calculus-ab-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Limits and Continuity
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-ab/unit-1`
- **App page’s published multiple-choice weight range:** 10%–12%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab); [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam); [AP Calculus AB Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Differentiation: Definition and Fundamental Properties

- **Stable ID:** `ap-calculus-ab-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Differentiation: Definition and Fundamental Properties
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-ab/unit-2`
- **App page’s published multiple-choice weight range:** 10%–12%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab); [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam); [AP Calculus AB Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Differentiation: Composite, Implicit, and Inverse Functions

- **Stable ID:** `ap-calculus-ab-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Differentiation: Composite, Implicit, and Inverse Functions
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-ab/unit-3`
- **App page’s published multiple-choice weight range:** 9%–13%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab); [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam); [AP Calculus AB Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Contextual Applications of Differentiation

- **Stable ID:** `ap-calculus-ab-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Contextual Applications of Differentiation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-ab/unit-4`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab); [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam); [AP Calculus AB Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Analytical Applications of Differentiation

- **Stable ID:** `ap-calculus-ab-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Analytical Applications of Differentiation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-ab/unit-5`
- **App page’s published multiple-choice weight range:** 15%–18%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab); [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam); [AP Calculus AB Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Integration and Accumulation of Change

- **Stable ID:** `ap-calculus-ab-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Integration and Accumulation of Change
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-ab/unit-6`
- **App page’s published multiple-choice weight range:** 17%–20%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab); [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam); [AP Calculus AB Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Differential Equations

- **Stable ID:** `ap-calculus-ab-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Differential Equations
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-ab/unit-7`
- **App page’s published multiple-choice weight range:** 6%–12%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab); [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam); [AP Calculus AB Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Applications of Integration

- **Stable ID:** `ap-calculus-ab-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: Applications of Integration
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-ab/unit-8`
- **App page’s published multiple-choice weight range:** 10%–15%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab); [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam); [AP Calculus AB Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Calculus BC

**Official name:** AP Calculus BC<br>
**Category:** math<br>
**Current app units:** 10<br>
**Official framework units in this snapshot:** 10<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Limits and Continuity; Unit 2: Differentiation: Definition and Fundamental Properties; Unit 3: Differentiation: Composite, Implicit, and Inverse Functions; Unit 4: Contextual Applications of Differentiation; Unit 5: Analytical Applications of Differentiation; Unit 6: Integration and Accumulation of Change; Unit 7: Differential Equations; Unit 8: Applications of Integration; Unit 9: Parametric Equations, Polar Coordinates, and Vector-Valued Functions; Unit 10: Infinite Sequences and Series.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: mathematical processes; equivalent representations; justification and communication; modeling and interpretation.
Official sources: [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 190 minutes. Calculator policy: permitted with section-specific restrictions.

- **Section I: Multiple Choice** - 42 questions; 100 minutes; 50% of the exam score.
- Question/task types: analytical; graphical; tabular; verbal.
- Part **A**: questionCount=29; durationMinutes=62; calculatorPolicy=not-permitted.
- Part **B**: questionCount=13; durationMinutes=38; calculatorPolicy=graphing-calculator-required.
- **Section II: Free Response** - 6 questions; 90 minutes; 50% of the exam score.
- Question/task types: procedural; conceptual; real-world-context.
- Part **A**: questionCount=2; durationMinutes=30; calculatorPolicy=graphing-calculator-required.
- Part **B**: questionCount=4; durationMinutes=60; calculatorPolicy=not-permitted.
  Reference materials: reference information in Bluebook.
- Assessment note: At least two free-response questions incorporate a real-world context or scenario.
- 2026–27 update: Minor 2026–27 clarifications; updated question count and timing effective May 2027.

#### Current app units and source context

##### Unit 1: Limits and Continuity

- **Stable ID:** `ap-calculus-bc-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Limits and Continuity
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-bc/unit-1`
- **App page’s published multiple-choice weight range:** 4%–7%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Differentiation: Definition and Fundamental Properties

- **Stable ID:** `ap-calculus-bc-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Differentiation: Definition and Fundamental Properties
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-bc/unit-2`
- **App page’s published multiple-choice weight range:** 4%–7%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Differentiation: Composite, Implicit, and Inverse Functions

- **Stable ID:** `ap-calculus-bc-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Differentiation: Composite, Implicit, and Inverse Functions
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-bc/unit-3`
- **App page’s published multiple-choice weight range:** 4%–7%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Contextual Applications of Differentiation

- **Stable ID:** `ap-calculus-bc-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Contextual Applications of Differentiation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-bc/unit-4`
- **App page’s published multiple-choice weight range:** 6%–9%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Analytical Applications of Differentiation

- **Stable ID:** `ap-calculus-bc-unit-5`
- **Semester:** 1
- **Official canonical label:** Unit 5: Analytical Applications of Differentiation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-bc/unit-5`
- **App page’s published multiple-choice weight range:** 8%–11%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Integration and Accumulation of Change

- **Stable ID:** `ap-calculus-bc-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Integration and Accumulation of Change
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-bc/unit-6`
- **App page’s published multiple-choice weight range:** 17%–20%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Differential Equations

- **Stable ID:** `ap-calculus-bc-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Differential Equations
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-bc/unit-7`
- **App page’s published multiple-choice weight range:** 6%–9%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Applications of Integration

- **Stable ID:** `ap-calculus-bc-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: Applications of Integration
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-bc/unit-8`
- **App page’s published multiple-choice weight range:** 6%–9%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 9: Parametric Equations, Polar Coordinates, and Vector-Valued Functions

- **Stable ID:** `ap-calculus-bc-unit-9`
- **Semester:** 2
- **Official canonical label:** Unit 9: Parametric Equations, Polar Coordinates, and Vector-Valued Functions
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-bc/unit-9`
- **App page’s published multiple-choice weight range:** 11%–12%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 10: Infinite Sequences and Series

- **Stable ID:** `ap-calculus-bc-unit-10`
- **Semester:** 2
- **Official canonical label:** Unit 10: Infinite Sequences and Series
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-calculus-bc/unit-10`
- **App page’s published multiple-choice weight range:** 17%–18%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc); [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam); [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Statistics

**Official name:** AP Statistics<br>
**Category:** math<br>
**Current app units:** 9<br>
**Official framework units in this snapshot:** 5<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Exploring One-Variable Data and Collecting Data; Unit 2: Probability, Random Variables, and Probability Distributions; Unit 3: Inference for Categorical Data: Proportions; Unit 4: Inference for Quantitative Data: Means; Unit 5: Regression Analysis.
Official framework alignment: official-current-framework-differs-from-app-base-catalog.
Skills: selecting statistical methods; describing distributions and relationships; collecting data; probability and simulation; inference and communication.
Official sources: [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics); [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam); [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 180 minutes. Calculator policy: permitted.

- **Section I: Multiple Choice** - 42 questions; 90 minutes; 50% of the exam score.
- Question/task types: individual; shared-prompt-set.
- **Section II: Free Response** - 4 questions; 90 minutes; 50% of the exam score.
- Question/task types: multi-focus-practices-1-and-2; multi-focus-practices-3-and-4; inference; multi-focus-practices-2-3-and-4.
  Reference materials: reference information in Bluebook.
- Assessment note: The course and exam were revised for the 2026–27 school year.
- 2026–27 update: Use the revised 2026–27 CED and exam information; do not rely on the prior nine-unit framework.

#### Current app units and source context

##### Unit 1: Exploring One-Variable Data

- **Stable ID:** `ap-statistics-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Exploring One-Variable Data and Collecting Data
- **Canonical-label status:** official-label-differs-from-app-label
- **Practice page:** `ap-statistics/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics); [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam); [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Exploring Two-Variable Data

- **Stable ID:** `ap-statistics-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Probability, Random Variables, and Probability Distributions
- **Canonical-label status:** official-label-differs-from-app-label
- **Practice page:** `ap-statistics/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics); [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam); [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Collecting Data

- **Stable ID:** `ap-statistics-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Inference for Categorical Data: Proportions
- **Canonical-label status:** official-label-differs-from-app-label
- **Practice page:** `ap-statistics/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics); [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam); [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Probability, Random Variables, and Probability Distributions

- **Stable ID:** `ap-statistics-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Inference for Quantitative Data: Means
- **Canonical-label status:** official-label-differs-from-app-label
- **Practice page:** `ap-statistics/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics); [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam); [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Sampling Distributions

- **Stable ID:** `ap-statistics-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Regression Analysis
- **Canonical-label status:** official-label-differs-from-app-label
- **Practice page:** `ap-statistics/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics); [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam); [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Inference for Categorical Data: Proportions

- **Stable ID:** `ap-statistics-unit-6`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-statistics/unit-6`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics); [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam); [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Inference for Quantitative Data: Means

- **Stable ID:** `ap-statistics-unit-7`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-statistics/unit-7`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics); [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam); [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Inference for Categorical Data: Chi-Square

- **Stable ID:** `ap-statistics-unit-8`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-statistics/unit-8`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics); [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam); [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 9: Inference for Quantitative Data: Slopes

- **Stable ID:** `ap-statistics-unit-9`
- **Semester:** 2
- **Official canonical label:** none in the current official framework; retained as an app-only/legacy label
- **Canonical-label status:** app-only-label-not-in-current-official-framework
- **Practice page:** `ap-statistics/unit-9`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics); [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam); [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Precalculus

**Official name:** AP Precalculus<br>
**Category:** math<br>
**Current app units:** 4<br>
**Official framework units in this snapshot:** 4<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Polynomial and Rational Functions; Unit 2: Exponential and Logarithmic Functions; Unit 3: Trigonometric and Polar Functions; Unit 4: Functions Involving Parameters, Vectors, and Matrices.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: modeling; equivalent representations; mathematical reasoning; communication and interpretation.
Official sources: [AP Precalculus course page](https://apcentral.collegeboard.org/courses/ap-precalculus); [AP Precalculus exam page](https://apcentral.collegeboard.org/courses/ap-precalculus/exam); [AP Precalculus Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-precalculus-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 175 minutes. Calculator policy: permitted with section-specific restrictions.

- **Section I: Multiple Choice** - 42 questions; 105 minutes; 62.5% of the exam score.
- Part **A**: questionCount=29; durationMinutes=65; weightPercent=43.75; calculatorPolicy=not-permitted.
- Part **B**: questionCount=13; durationMinutes=40; weightPercent=18.75; calculatorPolicy=graphing-calculator-required.
- **Section II: Free Response** - 4 questions; 70 minutes; 37.5% of the exam score.
- Part **A**: questionCount=2; durationMinutes=35; weightPercent=18.75; calculatorPolicy=graphing-calculator-required; questionTypes=function-concepts,modeling-non-periodic-context.
- Part **B**: questionCount=2; durationMinutes=35; weightPercent=18.75; calculatorPolicy=not-permitted; questionTypes=modeling-periodic-context,symbolic-manipulations.
  Reference materials: reference information in Bluebook.
- Assessment note: The 2027 structure updates the question counts and timing for the exam.
- 2026–27 update: Minor 2026–27 clarifications; updated question count, FRQ 1/2 structure, and timing effective May 2027.

#### Current app units and source context

##### Unit 1: Polynomial and Rational Functions

- **Stable ID:** `ap-precalculus-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Polynomial and Rational Functions
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-precalculus/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Precalculus course page](https://apcentral.collegeboard.org/courses/ap-precalculus); [AP Precalculus exam page](https://apcentral.collegeboard.org/courses/ap-precalculus/exam); [AP Precalculus Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-precalculus-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Exponential and Logarithmic Functions

- **Stable ID:** `ap-precalculus-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Exponential and Logarithmic Functions
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-precalculus/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Precalculus course page](https://apcentral.collegeboard.org/courses/ap-precalculus); [AP Precalculus exam page](https://apcentral.collegeboard.org/courses/ap-precalculus/exam); [AP Precalculus Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-precalculus-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Trigonometric and Polar Functions

- **Stable ID:** `ap-precalculus-unit-3`
- **Semester:** 2
- **Official canonical label:** Unit 3: Trigonometric and Polar Functions
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-precalculus/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Precalculus course page](https://apcentral.collegeboard.org/courses/ap-precalculus); [AP Precalculus exam page](https://apcentral.collegeboard.org/courses/ap-precalculus/exam); [AP Precalculus Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-precalculus-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Functions Involving Parameters, Vectors, and Matrices

- **Stable ID:** `ap-precalculus-unit-4`
- **Semester:** 2
- **Official canonical label:** Unit 4: Functions Involving Parameters, Vectors, and Matrices
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-precalculus/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Precalculus course page](https://apcentral.collegeboard.org/courses/ap-precalculus); [AP Precalculus exam page](https://apcentral.collegeboard.org/courses/ap-precalculus/exam); [AP Precalculus Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-precalculus-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Computer Science A

**Official name:** AP Computer Science A<br>
**Category:** computer-science<br>
**Current app units:** 4<br>
**Official framework units in this snapshot:** 4<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Using Objects and Methods; Unit 2: Selection and Iteration; Unit 3: Class Creation; Unit 4: Data Collections.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: data abstraction; algorithms and program development; code analysis; object-oriented design; testing and debugging.
Official sources: [AP Computer Science A course page](https://apcentral.collegeboard.org/courses/ap-computer-science-a); [AP Computer Science A exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam); [AP Computer Science A Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 180 minutes. Calculator policy: not specified as a permitted exam tool; Java Quick Reference is provided.

- **Section I: Multiple Choice** - 42 questions; 90 minutes; 55% of the exam score.
- Question/task types: individual; small-set.
- **Section II: Free Response** - 4 questions; 90 minutes; 45% of the exam score.
- Question/task types: methods-and-control-structures; class-design; data-analysis-with-arraylist; two-dimensional-array.
- Note: All FRQs assess the Develop Code computational thinking practice.
  Reference materials: Java Quick Reference.
- Assessment note: All responses are submitted in Bluebook.

#### Current app units and source context

##### Unit 1: Using Objects and Methods

- **Stable ID:** `ap-computer-science-a-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Using Objects and Methods
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-computer-science-a/unit-1`
- **App page’s published multiple-choice weight range:** 15%–25%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Computer Science A course page](https://apcentral.collegeboard.org/courses/ap-computer-science-a); [AP Computer Science A exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam); [AP Computer Science A Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Selection and Iteration

- **Stable ID:** `ap-computer-science-a-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Selection and Iteration
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-computer-science-a/unit-2`
- **App page’s published multiple-choice weight range:** 25%–35%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Computer Science A course page](https://apcentral.collegeboard.org/courses/ap-computer-science-a); [AP Computer Science A exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam); [AP Computer Science A Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Class Creation

- **Stable ID:** `ap-computer-science-a-unit-3`
- **Semester:** 2
- **Official canonical label:** Unit 3: Class Creation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-computer-science-a/unit-3`
- **App page’s published multiple-choice weight range:** 10%–18%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Computer Science A course page](https://apcentral.collegeboard.org/courses/ap-computer-science-a); [AP Computer Science A exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam); [AP Computer Science A Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Data Collections

- **Stable ID:** `ap-computer-science-a-unit-4`
- **Semester:** 2
- **Official canonical label:** Unit 4: Data Collections
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-computer-science-a/unit-4`
- **App page’s published multiple-choice weight range:** 30%–40%.
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Computer Science A course page](https://apcentral.collegeboard.org/courses/ap-computer-science-a); [AP Computer Science A exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam); [AP Computer Science A Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Computer Science Principles

**Official name:** AP Computer Science Principles<br>
**Category:** computer-science<br>
**Current app units:** 5<br>
**Official framework units in this snapshot:** 5<br>
**Delivery:** fully-digital-plus-through-course-task<br>
**App FRQ:** disabled in the current app

Official framework labels: Big Idea 1: Creative Development; Big Idea 2: Data; Big Idea 3: Algorithms and Programming; Big Idea 4: Computer Systems and Networks; Big Idea 5: Impact of Computing.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: creative development; data; algorithms and programming; computer systems and networks; impact of computing.
Official sources: [AP Computer Science Principles course page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles); [AP Computer Science Principles exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles/exam); [AP Computer Science Principles Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 180 minutes. Calculator policy: not applicable to the documented assessment contract.

- **Section I: End-of-Course Multiple Choice** - 70 questions; 120 minutes; 70% of the exam score.
- Question/task types: single-select; single-select-with-reading-passage; multiple-select-two-answers.
- Note: 57 single-select, 5 single-select reading-passage, and 8 multiple-select questions.
- **Create Performance Task** - through-course component; administered separately; 30% of the exam score.
- Question/task types: program-code; video; personalized-project-reference.
- Note: Students receive 9 hours of in-class time; submission is through the AP Digital Portfolio.
- **Create-Related Written Responses** - 2 questions; 60 minutes; weight described in the course framework.
- Question/task types: program-design-function-purpose; algorithm-development; errors-and-testing; data-and-procedural-abstraction.
- Note: Students respond using their Personalized Project Reference.
  Reference materials: Personalized Project Reference.
- Assessment note: This course has a through-course Create performance task rather than a conventional FRQ section.
- 2026–27 update: Performance-task deadline and end-of-course assessment dates are administered separately.

#### Current app units and source context

##### Big Idea 1: Creative Development

- **Stable ID:** `ap-computer-science-principles-unit-1`
- **Semester:** 1
- **Official canonical label:** Big Idea 1: Creative Development
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-computer-science-principles/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Computer Science Principles course page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles); [AP Computer Science Principles exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles/exam); [AP Computer Science Principles Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Big Idea 2: Data

- **Stable ID:** `ap-computer-science-principles-unit-2`
- **Semester:** 1
- **Official canonical label:** Big Idea 2: Data
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-computer-science-principles/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Computer Science Principles course page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles); [AP Computer Science Principles exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles/exam); [AP Computer Science Principles Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Big Idea 3: Algorithms and Programming

- **Stable ID:** `ap-computer-science-principles-unit-3`
- **Semester:** 1
- **Official canonical label:** Big Idea 3: Algorithms and Programming
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-computer-science-principles/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Computer Science Principles course page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles); [AP Computer Science Principles exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles/exam); [AP Computer Science Principles Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Big Idea 4: Computer Systems and Networks

- **Stable ID:** `ap-computer-science-principles-unit-4`
- **Semester:** 2
- **Official canonical label:** Big Idea 4: Computer Systems and Networks
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-computer-science-principles/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Computer Science Principles course page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles); [AP Computer Science Principles exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles/exam); [AP Computer Science Principles Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Big Idea 5: Impact of Computing

- **Stable ID:** `ap-computer-science-principles-unit-5`
- **Semester:** 2
- **Official canonical label:** Big Idea 5: Impact of Computing
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-computer-science-principles/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Computer Science Principles course page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles); [AP Computer Science Principles exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles/exam); [AP Computer Science Principles Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP English Language

**Official name:** AP English Language and Composition<br>
**Category:** english<br>
**Current app units:** 9<br>
**Official framework units in this snapshot:** 9<br>
**Delivery:** fully-digital<br>
**App FRQ:** enabled (ap-english-language-frq-profile)

Official framework labels: Unit 1: The Rhetorical Situation; Unit 2: Rhetorical Appeals; Unit 3: Claims and Evidence; Unit 4: Reasoning and Organization; Unit 5: Style; Unit 6: Argumentation; Unit 7: Research and Synthesis; Unit 8: Writing Process; Unit 9: Revision and Reflection.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: rhetorical situation analysis; claims and evidence; reasoning and organization; style and revision; synthesis and argumentation.
Official sources: [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition); [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam); [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 195 minutes. Calculator policy: not applicable.

- **Section I: Multiple Choice** - 45 questions; 60 minutes; 45% of the exam score.
- Question/task types: reading-analysis; writing-revision.
- Note: Five sets: 23–25 reading questions and 20–22 writing questions.
- **Section II: Free Response** - 3 questions; 135 minutes; 55% of the exam score.
- Question/task types: synthesis; rhetorical-analysis; argument.
- Note: Includes a 15-minute reading period.
  Reference materials: source materials supplied with the prompts.
- Assessment note: The synthesis prompt provides six texts, including visual and quantitative sources.

#### Current app units and source context

##### Unit 1: The Rhetorical Situation

- **Stable ID:** `ap-english-language-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: The Rhetorical Situation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-language/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition); [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam); [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Rhetorical Appeals

- **Stable ID:** `ap-english-language-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Rhetorical Appeals
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-language/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition); [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam); [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Claims and Evidence

- **Stable ID:** `ap-english-language-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Claims and Evidence
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-language/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition); [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam); [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Reasoning and Organization

- **Stable ID:** `ap-english-language-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Reasoning and Organization
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-language/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition); [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam); [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Style

- **Stable ID:** `ap-english-language-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Style
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-language/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition); [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam); [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Argumentation

- **Stable ID:** `ap-english-language-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Argumentation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-language/unit-6`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition); [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam); [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Research and Synthesis

- **Stable ID:** `ap-english-language-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Research and Synthesis
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-language/unit-7`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition); [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam); [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Writing Process

- **Stable ID:** `ap-english-language-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: Writing Process
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-language/unit-8`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition); [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam); [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 9: Revision and Reflection

- **Stable ID:** `ap-english-language-unit-9`
- **Semester:** 2
- **Official canonical label:** Unit 9: Revision and Reflection
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-language/unit-9`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition); [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam); [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP English Literature

**Official name:** AP English Literature and Composition<br>
**Category:** english<br>
**Current app units:** 9<br>
**Official framework units in this snapshot:** 9<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Short Fiction I; Unit 2: Poetry I; Unit 3: Longer Fiction or Drama I; Unit 4: Short Fiction II; Unit 5: Poetry II; Unit 6: Longer Fiction or Drama II; Unit 7: Short Fiction III; Unit 8: Poetry III; Unit 9: Longer Fiction or Drama III.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: literary analysis; evidence and commentary; interpretation; comparative and thematic reasoning; written argument.
Official sources: [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition); [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam); [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 180 minutes. Calculator policy: not applicable.

- **Section I: Multiple Choice** - 55 questions; 60 minutes; 45% of the exam score.
- Question/task types: prose-fiction-set; poetry-set.
- Note: Five passage sets; at least two prose-fiction/drama passages and two poetry passages.
- **Section II: Free Response** - 3 questions; 120 minutes; 55% of the exam score.
- Question/task types: poetry-analysis; prose-fiction-or-drama-analysis; student-selected-work-analysis.
  Reference materials: literary passages supplied with the prompts.
- Assessment note: Free-response essays use analytic rubrics.

#### Current app units and source context

##### Unit 1: Short Fiction I

- **Stable ID:** `ap-english-literature-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Short Fiction I
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-literature/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition); [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam); [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Poetry I

- **Stable ID:** `ap-english-literature-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Poetry I
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-literature/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition); [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam); [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Longer Fiction or Drama I

- **Stable ID:** `ap-english-literature-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Longer Fiction or Drama I
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-literature/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition); [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam); [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Short Fiction II

- **Stable ID:** `ap-english-literature-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Short Fiction II
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-literature/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition); [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam); [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Poetry II

- **Stable ID:** `ap-english-literature-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Poetry II
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-literature/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition); [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam); [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Longer Fiction or Drama II

- **Stable ID:** `ap-english-literature-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Longer Fiction or Drama II
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-literature/unit-6`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition); [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam); [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Short Fiction III

- **Stable ID:** `ap-english-literature-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Short Fiction III
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-literature/unit-7`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition); [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam); [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Poetry III

- **Stable ID:** `ap-english-literature-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: Poetry III
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-literature/unit-8`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition); [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam); [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 9: Longer Fiction or Drama III

- **Stable ID:** `ap-english-literature-unit-9`
- **Semester:** 2
- **Official canonical label:** Unit 9: Longer Fiction or Drama III
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-english-literature/unit-9`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition); [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam); [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP US History

**Official name:** AP United States History<br>
**Category:** history<br>
**Current app units:** 9<br>
**Official framework units in this snapshot:** 9<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Period 1: 1491–1607; Unit 2: Period 2: 1607–1754; Unit 3: Period 3: 1754–1800; Unit 4: Period 4: 1800–1848; Unit 5: Period 5: 1844–1877; Unit 6: Period 6: 1865–1898; Unit 7: Period 7: 1890–1945; Unit 8: Period 8: 1945–1980; Unit 9: Period 9: 1980–Present.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: developments and processes; sourcing and situation; claims and evidence; contextualization; making connections; argumentation.
Official sources: [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history); [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam); [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information); [AP History Exam Updates](https://apcentral.collegeboard.org/courses/ap-history-exam-updates).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 195 minutes. Calculator policy: not applicable.

- **Section I, Part A: Multiple Choice** - 55 questions; 55 minutes; 40% of the exam score.
- Question/task types: source-set.
- Note: Uses primary and secondary sources, images, graphs, and maps.
- **Section I, Part B: Short Answer** - 3 questions; 40 minutes; 20% of the exam score.
- Question/task types: secondary-text-source; primary-text-source; primary-or-secondary-non-text-source.
- **Section II: Document-Based Question and Long Essay** - 2 questions; 100 minutes; 40% of the exam score.
- Question/task types: document-based-question; long-essay.
- Part **dbq**: durationMinutes=60; weightPercent=25; notes=Seven documents; includes a 15-minute reading period..
- Part **leq**: durationMinutes=40; weightPercent=15.
  Reference materials: historical sources supplied with prompts.
- Assessment note: The 2027 history updates apply to SAQ and LEQ format; course content is unchanged.
- 2026–27 update: All three SAQs are required and include source material; the LEQ repositions choice within the prompt.

#### Current app units and source context

##### Unit 1: Period 1: 1491–1607

- **Stable ID:** `ap-us-history-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Period 1: 1491–1607
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-history/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history); [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam); [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Period 2: 1607–1754

- **Stable ID:** `ap-us-history-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Period 2: 1607–1754
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-history/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history); [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam); [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Period 3: 1754–1800

- **Stable ID:** `ap-us-history-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Period 3: 1754–1800
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-history/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history); [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam); [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Period 4: 1800–1848

- **Stable ID:** `ap-us-history-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Period 4: 1800–1848
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-history/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history); [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam); [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Period 5: 1844–1877

- **Stable ID:** `ap-us-history-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Period 5: 1844–1877
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-history/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history); [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam); [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Period 6: 1865–1898

- **Stable ID:** `ap-us-history-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Period 6: 1865–1898
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-history/unit-6`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history); [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam); [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Period 7: 1890–1945

- **Stable ID:** `ap-us-history-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Period 7: 1890–1945
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-history/unit-7`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history); [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam); [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Period 8: 1945–1980

- **Stable ID:** `ap-us-history-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: Period 8: 1945–1980
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-history/unit-8`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history); [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam); [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 9: Period 9: 1980–Present

- **Stable ID:** `ap-us-history-unit-9`
- **Semester:** 2
- **Official canonical label:** Unit 9: Period 9: 1980–Present
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-history/unit-9`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history); [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam); [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP World History

**Official name:** AP World History: Modern<br>
**Category:** history<br>
**Current app units:** 9<br>
**Official framework units in this snapshot:** 9<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: The Global Tapestry; Unit 2: Networks of Exchange; Unit 3: Land-Based Empires; Unit 4: Transoceanic Interconnections; Unit 5: Revolutions; Unit 6: Consequences of Industrialization; Unit 7: Global Conflict; Unit 8: Cold War and Decolonization; Unit 9: Globalization.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: developments and processes; sourcing and situation; claims and evidence; contextualization; making connections; argumentation.
Official sources: [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history); [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam); [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information); [AP History Exam Updates](https://apcentral.collegeboard.org/courses/ap-history-exam-updates).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 195 minutes. Calculator policy: not applicable.

- **Section I, Part A: Multiple Choice** - 55 questions; 55 minutes; 40% of the exam score.
- Question/task types: source-set.
- Note: Uses primary and secondary sources, images, graphs, and maps.
- **Section I, Part B: Short Answer** - 3 questions; 40 minutes; 20% of the exam score.
- Question/task types: secondary-text-source; primary-text-source; primary-or-secondary-non-text-source.
- **Section II: Document-Based Question and Long Essay** - 2 questions; 100 minutes; 40% of the exam score.
- Question/task types: document-based-question; long-essay.
- Part **dbq**: durationMinutes=60; weightPercent=25; notes=Seven documents; includes a 15-minute reading period..
- Part **leq**: durationMinutes=40; weightPercent=15.
  Reference materials: historical sources supplied with prompts.
- Assessment note: The course covers approximately 1200 CE to the present.
- 2026–27 update: All three SAQs are required and include source material; the LEQ repositions choice within the prompt.

#### Current app units and source context

##### Unit 1: The Global Tapestry

- **Stable ID:** `ap-world-history-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: The Global Tapestry
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-world-history/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history); [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam); [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Networks of Exchange

- **Stable ID:** `ap-world-history-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Networks of Exchange
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-world-history/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history); [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam); [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Land-Based Empires

- **Stable ID:** `ap-world-history-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Land-Based Empires
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-world-history/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history); [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam); [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Transoceanic Interconnections

- **Stable ID:** `ap-world-history-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Transoceanic Interconnections
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-world-history/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history); [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam); [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Revolutions

- **Stable ID:** `ap-world-history-unit-5`
- **Semester:** 1
- **Official canonical label:** Unit 5: Revolutions
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-world-history/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history); [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam); [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Consequences of Industrialization

- **Stable ID:** `ap-world-history-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Consequences of Industrialization
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-world-history/unit-6`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history); [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam); [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Global Conflict

- **Stable ID:** `ap-world-history-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Global Conflict
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-world-history/unit-7`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history); [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam); [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: Cold War and Decolonization

- **Stable ID:** `ap-world-history-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: Cold War and Decolonization
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-world-history/unit-8`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history); [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam); [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 9: Globalization

- **Stable ID:** `ap-world-history-unit-9`
- **Semester:** 2
- **Official canonical label:** Unit 9: Globalization
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-world-history/unit-9`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history); [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam); [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP European History

**Official name:** AP European History<br>
**Category:** history<br>
**Current app units:** 9<br>
**Official framework units in this snapshot:** 9<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Renaissance and Exploration; Unit 2: Age of Reformation; Unit 3: Absolutism and Constitutionalism; Unit 4: Scientific, Philosophical, and Political Developments; Unit 5: Conflict, Crisis, and Reaction in the Late 18th Century; Unit 6: Industrialization and Its Effects; Unit 7: 19th-Century Perspectives and Political Developments; Unit 8: 20th-Century Global Conflicts; Unit 9: Cold War and Contemporary Europe.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: developments and processes; sourcing and situation; claims and evidence; contextualization; making connections; argumentation.
Official sources: [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history); [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam); [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information); [AP History Exam Updates](https://apcentral.collegeboard.org/courses/ap-history-exam-updates).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 195 minutes. Calculator policy: not applicable.

- **Section I, Part A: Multiple Choice** - 55 questions; 55 minutes; 40% of the exam score.
- Question/task types: source-set.
- Note: Uses primary and secondary sources, images, graphs, and maps.
- **Section I, Part B: Short Answer** - 3 questions; 40 minutes; 20% of the exam score.
- Question/task types: secondary-text-source; primary-text-source; primary-or-secondary-non-text-source.
- **Section II: Document-Based Question and Long Essay** - 2 questions; 100 minutes; 40% of the exam score.
- Question/task types: document-based-question; long-essay.
- Part **dbq**: durationMinutes=60; weightPercent=25; notes=Seven documents; includes a 15-minute reading period..
- Part **leq**: durationMinutes=40; weightPercent=15.
  Reference materials: historical sources supplied with prompts.
- Assessment note: The course covers approximately 1450 to 2001.
- 2026–27 update: All three SAQs are required and include source material; the LEQ repositions choice within the prompt.

#### Current app units and source context

##### Unit 1: Renaissance and Exploration

- **Stable ID:** `ap-european-history-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Renaissance and Exploration
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-european-history/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history); [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam); [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Age of Reformation

- **Stable ID:** `ap-european-history-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Age of Reformation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-european-history/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history); [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam); [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Absolutism and Constitutionalism

- **Stable ID:** `ap-european-history-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Absolutism and Constitutionalism
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-european-history/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history); [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam); [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Scientific, Philosophical, and Political Developments

- **Stable ID:** `ap-european-history-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Scientific, Philosophical, and Political Developments
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-european-history/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history); [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam); [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Conflict, Crisis, and Reaction in the Late 18th Century

- **Stable ID:** `ap-european-history-unit-5`
- **Semester:** 1
- **Official canonical label:** Unit 5: Conflict, Crisis, and Reaction in the Late 18th Century
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-european-history/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history); [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam); [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Industrialization and Its Effects

- **Stable ID:** `ap-european-history-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Industrialization and Its Effects
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-european-history/unit-6`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history); [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam); [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: 19th-Century Perspectives and Political Developments

- **Stable ID:** `ap-european-history-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: 19th-Century Perspectives and Political Developments
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-european-history/unit-7`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history); [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam); [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 8: 20th-Century Global Conflicts

- **Stable ID:** `ap-european-history-unit-8`
- **Semester:** 2
- **Official canonical label:** Unit 8: 20th-Century Global Conflicts
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-european-history/unit-8`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history); [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam); [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 9: Cold War and Contemporary Europe

- **Stable ID:** `ap-european-history-unit-9`
- **Semester:** 2
- **Official canonical label:** Unit 9: Cold War and Contemporary Europe
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-european-history/unit-9`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history); [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam); [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP US Government

**Official name:** AP United States Government and Politics<br>
**Category:** social-science<br>
**Current app units:** 5<br>
**Official framework units in this snapshot:** 5<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Foundations of American Democracy; Unit 2: Interactions Among Branches of Government; Unit 3: Civil Liberties and Civil Rights; Unit 4: American Political Ideologies and Beliefs; Unit 5: Political Participation.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: concept application; quantitative analysis; qualitative analysis; visual analysis; argumentation; foundational-document reasoning.
Official sources: [AP United States Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics); [AP United States Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics/exam); [AP United States Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-government-and-politics-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 180 minutes. Calculator policy: not applicable.

- **Section I: Multiple Choice** - 55 questions; 80 minutes; 50% of the exam score.
- Question/task types: individual; quantitative-analysis-set; qualitative-analysis-set; visual-analysis-set.
- **Section II: Free Response** - 4 questions; 100 minutes; 50% of the exam score.
- Question/task types: concept-application; quantitative-analysis; scotus-comparison; argument-essay.
  Reference materials: required foundational documents and source materials.
- Assessment note: The 2026–27 CED adds four required foundational documents.
- 2026–27 update: Use the updated foundational-document list for 2026–27.

#### Current app units and source context

##### Unit 1: Foundations of American Democracy

- **Stable ID:** `ap-us-government-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Foundations of American Democracy
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-government/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics); [AP United States Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics/exam); [AP United States Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-government-and-politics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Interactions Among Branches of Government

- **Stable ID:** `ap-us-government-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Interactions Among Branches of Government
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-government/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics); [AP United States Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics/exam); [AP United States Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-government-and-politics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Civil Liberties and Civil Rights

- **Stable ID:** `ap-us-government-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Civil Liberties and Civil Rights
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-government/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics); [AP United States Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics/exam); [AP United States Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-government-and-politics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: American Political Ideologies and Beliefs

- **Stable ID:** `ap-us-government-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: American Political Ideologies and Beliefs
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-government/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics); [AP United States Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics/exam); [AP United States Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-government-and-politics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Political Participation

- **Stable ID:** `ap-us-government-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Political Participation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-us-government/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP United States Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics); [AP United States Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics/exam); [AP United States Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-government-and-politics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Comparative Government

**Official name:** AP Comparative Government and Politics<br>
**Category:** social-science<br>
**Current app units:** 5<br>
**Official framework units in this snapshot:** 5<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Political Systems, Regimes, and Governments; Unit 2: Political Institutions; Unit 3: Political Culture and Participation; Unit 4: Party and Electoral Systems and Citizen Organizations; Unit 5: Political and Economic Changes and Development.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: concept application; quantitative analysis; comparative analysis; argumentation; political systems reasoning.
Official sources: [AP Comparative Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics); [AP Comparative Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics/exam); [AP Comparative Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-comparative-government-and-politics-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 150 minutes. Calculator policy: not applicable.

- **Section I: Multiple Choice** - 55 questions; 60 minutes; 50% of the exam score.
- Question/task types: individual; quantitative-analysis-set; qualitative-analysis-set.
- Note: Usually 40–44 individual questions, three quantitative sets, and two qualitative sets.
- **Section II: Free Response** - 4 questions; 90 minutes; 50% of the exam score.
- Question/task types: concept-application; quantitative-analysis; comparative-analysis; argument-essay.
- Note: Course countries: China, Iran, Mexico, Nigeria, Russia, and the United Kingdom.
  Reference materials: source materials supplied with prompts.
- Assessment note: The six required course countries are part of the assessment scope.

#### Current app units and source context

##### Unit 1: Political Systems, Regimes, and Governments

- **Stable ID:** `ap-comparative-government-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Political Systems, Regimes, and Governments
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-comparative-government/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Comparative Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics); [AP Comparative Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics/exam); [AP Comparative Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-comparative-government-and-politics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Political Institutions

- **Stable ID:** `ap-comparative-government-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Political Institutions
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-comparative-government/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Comparative Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics); [AP Comparative Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics/exam); [AP Comparative Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-comparative-government-and-politics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Political Culture and Participation

- **Stable ID:** `ap-comparative-government-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Political Culture and Participation
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-comparative-government/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Comparative Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics); [AP Comparative Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics/exam); [AP Comparative Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-comparative-government-and-politics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Party and Electoral Systems and Citizen Organizations

- **Stable ID:** `ap-comparative-government-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Party and Electoral Systems and Citizen Organizations
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-comparative-government/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Comparative Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics); [AP Comparative Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics/exam); [AP Comparative Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-comparative-government-and-politics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Political and Economic Changes and Development

- **Stable ID:** `ap-comparative-government-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Political and Economic Changes and Development
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-comparative-government/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Comparative Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics); [AP Comparative Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics/exam); [AP Comparative Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-comparative-government-and-politics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Psychology

**Official name:** AP Psychology<br>
**Category:** social-science<br>
**Current app units:** 5<br>
**Official framework units in this snapshot:** 5<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Biological Bases of Behavior; Unit 2: Cognition; Unit 3: Development and Learning; Unit 4: Social Psychology and Personality; Unit 5: Mental and Physical Health.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: concept application; research methods and scientific investigation; data analysis; argumentation and evidence.
Official sources: [AP Psychology course page](https://apcentral.collegeboard.org/courses/ap-psychology); [AP Psychology exam page](https://apcentral.collegeboard.org/courses/ap-psychology/exam); [AP Psychology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-psychology-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 160 minutes. Calculator policy: not applicable.

- **Section I: Multiple Choice** - 75 questions; 90 minutes; 66.7% of the exam score.
- Question/task types: content-definition-and-explanation; concept-application; data-analysis; scientific-investigation.
- **Section II: Free Response** - 2 questions; 70 minutes; 33.3% of the exam score.
- Question/task types: article-analysis-question; evidence-based-question.
- Note: AAQ: one summarized peer-reviewed source and six parts; EBQ: three summarized peer-reviewed sources and three parts.
  Reference materials: summarized research sources supplied with prompts.
- Assessment note: AAQ and EBQ tasks are source-based and scored with point-based criteria.

#### Current app units and source context

##### Unit 1: Biological Bases of Behavior

- **Stable ID:** `ap-psychology-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Biological Bases of Behavior
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-psychology/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Psychology course page](https://apcentral.collegeboard.org/courses/ap-psychology); [AP Psychology exam page](https://apcentral.collegeboard.org/courses/ap-psychology/exam); [AP Psychology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-psychology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Cognition

- **Stable ID:** `ap-psychology-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Cognition
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-psychology/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Psychology course page](https://apcentral.collegeboard.org/courses/ap-psychology); [AP Psychology exam page](https://apcentral.collegeboard.org/courses/ap-psychology/exam); [AP Psychology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-psychology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Development and Learning

- **Stable ID:** `ap-psychology-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Development and Learning
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-psychology/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Psychology course page](https://apcentral.collegeboard.org/courses/ap-psychology); [AP Psychology exam page](https://apcentral.collegeboard.org/courses/ap-psychology/exam); [AP Psychology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-psychology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Social Psychology and Personality

- **Stable ID:** `ap-psychology-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Social Psychology and Personality
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-psychology/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Psychology course page](https://apcentral.collegeboard.org/courses/ap-psychology); [AP Psychology exam page](https://apcentral.collegeboard.org/courses/ap-psychology/exam); [AP Psychology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-psychology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Mental and Physical Health

- **Stable ID:** `ap-psychology-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Mental and Physical Health
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-psychology/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Psychology course page](https://apcentral.collegeboard.org/courses/ap-psychology); [AP Psychology exam page](https://apcentral.collegeboard.org/courses/ap-psychology/exam); [AP Psychology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-psychology-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Human Geography

**Official name:** AP Human Geography<br>
**Category:** social-science<br>
**Current app units:** 7<br>
**Official framework units in this snapshot:** 7<br>
**Delivery:** fully-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Thinking Geographically; Unit 2: Population and Migration Patterns and Processes; Unit 3: Cultural Patterns and Processes; Unit 4: Political Patterns and Processes; Unit 5: Agriculture and Rural Land-Use Patterns and Processes; Unit 6: Cities and Urban Land-Use Patterns and Processes; Unit 7: Industrial and Economic Development Patterns and Processes.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: geographic concepts and processes; spatial relationships; data and map analysis; geographic models; scale analysis.
Official sources: [AP Human Geography course page](https://apcentral.collegeboard.org/courses/ap-human-geography); [AP Human Geography exam page](https://apcentral.collegeboard.org/courses/ap-human-geography/exam); [AP Human Geography Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 135 minutes. Calculator policy: not applicable.

- **Section I: Multiple Choice** - 60 questions; 60 minutes; 50% of the exam score.
- Question/task types: individual; stimulus-set.
- Note: Approximately 30%–40% reference stimulus material, including maps, tables, charts, graphs, images, infographics, and landscapes.
- **Section II: Free Response** - 3 questions; 75 minutes; 50% of the exam score.
- Question/task types: no-stimulus-scenario; one-stimulus-scenario; two-stimulus-scenario.
- Note: At least one question assesses geographic scale and spatial relationships.
  Reference materials: geographic stimuli supplied with prompts.
- Assessment note: Each FRQ presents an authentic geographic situation or scenario.

#### Current app units and source context

##### Unit 1: Thinking Geographically

- **Stable ID:** `ap-human-geography-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Thinking Geographically
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-human-geography/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Human Geography course page](https://apcentral.collegeboard.org/courses/ap-human-geography); [AP Human Geography exam page](https://apcentral.collegeboard.org/courses/ap-human-geography/exam); [AP Human Geography Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Population and Migration Patterns and Processes

- **Stable ID:** `ap-human-geography-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Population and Migration Patterns and Processes
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-human-geography/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Human Geography course page](https://apcentral.collegeboard.org/courses/ap-human-geography); [AP Human Geography exam page](https://apcentral.collegeboard.org/courses/ap-human-geography/exam); [AP Human Geography Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Cultural Patterns and Processes

- **Stable ID:** `ap-human-geography-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Cultural Patterns and Processes
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-human-geography/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Human Geography course page](https://apcentral.collegeboard.org/courses/ap-human-geography); [AP Human Geography exam page](https://apcentral.collegeboard.org/courses/ap-human-geography/exam); [AP Human Geography Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Political Patterns and Processes

- **Stable ID:** `ap-human-geography-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Political Patterns and Processes
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-human-geography/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Human Geography course page](https://apcentral.collegeboard.org/courses/ap-human-geography); [AP Human Geography exam page](https://apcentral.collegeboard.org/courses/ap-human-geography/exam); [AP Human Geography Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Agriculture and Rural Land-Use Patterns and Processes

- **Stable ID:** `ap-human-geography-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Agriculture and Rural Land-Use Patterns and Processes
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-human-geography/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Human Geography course page](https://apcentral.collegeboard.org/courses/ap-human-geography); [AP Human Geography exam page](https://apcentral.collegeboard.org/courses/ap-human-geography/exam); [AP Human Geography Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Cities and Urban Land-Use Patterns and Processes

- **Stable ID:** `ap-human-geography-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Cities and Urban Land-Use Patterns and Processes
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-human-geography/unit-6`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Human Geography course page](https://apcentral.collegeboard.org/courses/ap-human-geography); [AP Human Geography exam page](https://apcentral.collegeboard.org/courses/ap-human-geography/exam); [AP Human Geography Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 7: Industrial and Economic Development Patterns and Processes

- **Stable ID:** `ap-human-geography-unit-7`
- **Semester:** 2
- **Official canonical label:** Unit 7: Industrial and Economic Development Patterns and Processes
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-human-geography/unit-7`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Human Geography course page](https://apcentral.collegeboard.org/courses/ap-human-geography); [AP Human Geography exam page](https://apcentral.collegeboard.org/courses/ap-human-geography/exam); [AP Human Geography Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Macroeconomics

**Official name:** AP Macroeconomics<br>
**Category:** economics<br>
**Current app units:** 6<br>
**Official framework units in this snapshot:** 6<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Basic Economic Concepts; Unit 2: Economic Indicators and the Business Cycle; Unit 3: National Income and Price Determination; Unit 4: Financial Sector; Unit 5: Long-Run Consequences of Stabilization Policies; Unit 6: Open Economy-International Trade and Finance.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: economic concepts and principles; model and graph interpretation; numerical analysis; assertion and explanation.
Official sources: [AP Macroeconomics course page](https://apcentral.collegeboard.org/courses/ap-macroeconomics); [AP Macroeconomics exam page](https://apcentral.collegeboard.org/courses/ap-macroeconomics/exam); [AP Macroeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 130 minutes. Calculator policy: permitted.

- **Section I: Multiple Choice** - 60 questions; 70 minutes; 66% of the exam score.
- Question/task types: economic-content-and-reasoning.
- **Section II: Free Response** - 3 questions; 60 minutes; 33% of the exam score.
- Question/task types: long-free-response; short-free-response.
- Note: One long FRQ is 50% of the section; two short FRQs are 25% each. Includes a 10-minute reading period.
  Reference materials: economic reference information.
- Assessment note: Official section weights are displayed as 66% and 33%, which reflect rounded reporting.

#### Current app units and source context

##### Unit 1: Basic Economic Concepts

- **Stable ID:** `ap-macroeconomics-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Basic Economic Concepts
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-macroeconomics/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Macroeconomics course page](https://apcentral.collegeboard.org/courses/ap-macroeconomics); [AP Macroeconomics exam page](https://apcentral.collegeboard.org/courses/ap-macroeconomics/exam); [AP Macroeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Economic Indicators and the Business Cycle

- **Stable ID:** `ap-macroeconomics-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Economic Indicators and the Business Cycle
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-macroeconomics/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Macroeconomics course page](https://apcentral.collegeboard.org/courses/ap-macroeconomics); [AP Macroeconomics exam page](https://apcentral.collegeboard.org/courses/ap-macroeconomics/exam); [AP Macroeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: National Income and Price Determination

- **Stable ID:** `ap-macroeconomics-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: National Income and Price Determination
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-macroeconomics/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Macroeconomics course page](https://apcentral.collegeboard.org/courses/ap-macroeconomics); [AP Macroeconomics exam page](https://apcentral.collegeboard.org/courses/ap-macroeconomics/exam); [AP Macroeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Financial Sector

- **Stable ID:** `ap-macroeconomics-unit-4`
- **Semester:** 2
- **Official canonical label:** Unit 4: Financial Sector
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-macroeconomics/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Macroeconomics course page](https://apcentral.collegeboard.org/courses/ap-macroeconomics); [AP Macroeconomics exam page](https://apcentral.collegeboard.org/courses/ap-macroeconomics/exam); [AP Macroeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Long-Run Consequences of Stabilization Policies

- **Stable ID:** `ap-macroeconomics-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Long-Run Consequences of Stabilization Policies
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-macroeconomics/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Macroeconomics course page](https://apcentral.collegeboard.org/courses/ap-macroeconomics); [AP Macroeconomics exam page](https://apcentral.collegeboard.org/courses/ap-macroeconomics/exam); [AP Macroeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Open Economy-International Trade and Finance

- **Stable ID:** `ap-macroeconomics-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Open Economy-International Trade and Finance
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-macroeconomics/unit-6`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Macroeconomics course page](https://apcentral.collegeboard.org/courses/ap-macroeconomics); [AP Macroeconomics exam page](https://apcentral.collegeboard.org/courses/ap-macroeconomics/exam); [AP Macroeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Microeconomics

**Official name:** AP Microeconomics<br>
**Category:** economics<br>
**Current app units:** 6<br>
**Official framework units in this snapshot:** 6<br>
**Delivery:** hybrid-digital<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Basic Economic Concepts; Unit 2: Supply and Demand; Unit 3: Production, Cost, and the Perfect Competition Model; Unit 4: Imperfect Competition; Unit 5: Factor Markets; Unit 6: Market Failure and the Role of Government.
Official framework alignment: course-level-unit-sequence-aligned.
Skills: economic concepts and principles; model and graph interpretation; numerical analysis; assertion and explanation.
Official sources: [AP Microeconomics course page](https://apcentral.collegeboard.org/courses/ap-microeconomics); [AP Microeconomics exam page](https://apcentral.collegeboard.org/courses/ap-microeconomics/exam); [AP Microeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 130 minutes. Calculator policy: permitted.

- **Section I: Multiple Choice** - 60 questions; 70 minutes; 66% of the exam score.
- Question/task types: economic-content-and-reasoning.
- **Section II: Free Response** - 3 questions; 60 minutes; 33% of the exam score.
- Question/task types: long-free-response; short-free-response.
- Note: One long FRQ is 50% of the section; two short FRQs are 25% each. Includes a 10-minute reading period.
  Reference materials: economic reference information.
- Assessment note: Official section weights are displayed as 66% and 33%, which reflect rounded reporting.

#### Current app units and source context

##### Unit 1: Basic Economic Concepts

- **Stable ID:** `ap-microeconomics-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Basic Economic Concepts
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-microeconomics/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Microeconomics course page](https://apcentral.collegeboard.org/courses/ap-microeconomics); [AP Microeconomics exam page](https://apcentral.collegeboard.org/courses/ap-microeconomics/exam); [AP Microeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Supply and Demand

- **Stable ID:** `ap-microeconomics-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Supply and Demand
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-microeconomics/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Microeconomics course page](https://apcentral.collegeboard.org/courses/ap-microeconomics); [AP Microeconomics exam page](https://apcentral.collegeboard.org/courses/ap-microeconomics/exam); [AP Microeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Production, Cost, and the Perfect Competition Model

- **Stable ID:** `ap-microeconomics-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Production, Cost, and the Perfect Competition Model
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-microeconomics/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Microeconomics course page](https://apcentral.collegeboard.org/courses/ap-microeconomics); [AP Microeconomics exam page](https://apcentral.collegeboard.org/courses/ap-microeconomics/exam); [AP Microeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Imperfect Competition

- **Stable ID:** `ap-microeconomics-unit-4`
- **Semester:** 1
- **Official canonical label:** Unit 4: Imperfect Competition
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-microeconomics/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Microeconomics course page](https://apcentral.collegeboard.org/courses/ap-microeconomics); [AP Microeconomics exam page](https://apcentral.collegeboard.org/courses/ap-microeconomics/exam); [AP Microeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Factor Markets

- **Stable ID:** `ap-microeconomics-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Factor Markets
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-microeconomics/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Microeconomics course page](https://apcentral.collegeboard.org/courses/ap-microeconomics); [AP Microeconomics exam page](https://apcentral.collegeboard.org/courses/ap-microeconomics/exam); [AP Microeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Market Failure and the Role of Government

- **Stable ID:** `ap-microeconomics-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Market Failure and the Role of Government
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-microeconomics/unit-6`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Microeconomics course page](https://apcentral.collegeboard.org/courses/ap-microeconomics); [AP Microeconomics exam page](https://apcentral.collegeboard.org/courses/ap-microeconomics/exam); [AP Microeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

### AP Spanish Language

**Official name:** AP Spanish Language and Culture<br>
**Category:** world-language<br>
**Current app units:** 6<br>
**Official framework units in this snapshot:** 6<br>
**Delivery:** fully-digital-plus-through-course-project<br>
**App FRQ:** disabled in the current app

Official framework labels: Unit 1: Families and Communities; Unit 2: Language and Culture; Unit 3: Art and Creativity; Unit 4: Science and Technology; Unit 5: Contemporary Life; Unit 6: Global Contexts.
Official framework alignment: official-current-framework-differs-from-app-base-catalog.
Skills: interpretive communication; interpersonal communication; presentational communication; cultural comparison; research and source use.
Official sources: [AP Spanish Language and Culture course page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture); [AP Spanish Language and Culture exam page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture/exam); [AP Spanish Language and Culture Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-spanish-language-and-culture-course-and-exam-description.pdf); [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy); [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information).
App sources: `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/data/ap-classes-data-08212026.json`; `src/lib/ap-knowledge/catalog.ts`.

#### Exam details

Exam duration in the snapshot: 145–150 minutes. Calculator policy: not applicable.

- **Section I: Free Response** - 3 questions; 65–70 minutes; 50% of the exam score.
- Question/task types: project-presentation; project-question-and-answer; argumentative-essay.
- Note: The official section time is 65–70 minutes.
- Part **project-presentation**: durationMinutes=3; weightPercent=20; notes=Three minutes to prepare and three minutes to present..
- Part **project-question-and-answer**: durationMinutes=3; weightPercent=15; notes=Four prerecorded questions; 40 seconds per response..
- Part **argumentative-essay**: durationMinutes=55; weightPercent=15; notes=Print and audio sources present different viewpoints..
- **Section II: Multiple Choice** - 55 questions; 80 minutes; 50% of the exam score.
- Question/task types: listening; reading.
- Part **listening**: questionCount=25; durationMinutes=40; weightPercent=25.
- Part **reading**: questionCount=30; durationMinutes=40; weightPercent=25.
  Reference materials: student project materials and source prompts.
- Assessment note: The 2026–27 revision moves the exam to Bluebook and includes a project that prepares students for two speaking tasks.
- 2026–27 update: World language exams transition to digital delivery beginning May 2027; PPR submission is due before the exam.

#### Current app units and source context

##### Unit 1: Families and Communities

- **Stable ID:** `ap-spanish-language-unit-1`
- **Semester:** 1
- **Official canonical label:** Unit 1: Families and Communities
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-spanish-language/unit-1`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Spanish Language and Culture course page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture); [AP Spanish Language and Culture exam page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture/exam); [AP Spanish Language and Culture Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-spanish-language-and-culture-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 2: Personal and Public Identities

- **Stable ID:** `ap-spanish-language-unit-2`
- **Semester:** 1
- **Official canonical label:** Unit 2: Language and Culture
- **Canonical-label status:** official-label-differs-from-app-label
- **Practice page:** `ap-spanish-language/unit-2`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Spanish Language and Culture course page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture); [AP Spanish Language and Culture exam page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture/exam); [AP Spanish Language and Culture Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-spanish-language-and-culture-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 3: Beauty and Aesthetics

- **Stable ID:** `ap-spanish-language-unit-3`
- **Semester:** 1
- **Official canonical label:** Unit 3: Art and Creativity
- **Canonical-label status:** official-label-differs-from-app-label
- **Practice page:** `ap-spanish-language/unit-3`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Spanish Language and Culture course page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture); [AP Spanish Language and Culture exam page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture/exam); [AP Spanish Language and Culture Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-spanish-language-and-culture-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 4: Science and Technology

- **Stable ID:** `ap-spanish-language-unit-4`
- **Semester:** 2
- **Official canonical label:** Unit 4: Science and Technology
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-spanish-language/unit-4`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Spanish Language and Culture course page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture); [AP Spanish Language and Culture exam page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture/exam); [AP Spanish Language and Culture Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-spanish-language-and-culture-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 5: Contemporary Life

- **Stable ID:** `ap-spanish-language-unit-5`
- **Semester:** 2
- **Official canonical label:** Unit 5: Contemporary Life
- **Canonical-label status:** matched-by-unit-number
- **Practice page:** `ap-spanish-language/unit-5`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Spanish Language and Culture course page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture); [AP Spanish Language and Culture exam page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture/exam); [AP Spanish Language and Culture Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-spanish-language-and-culture-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

##### Unit 6: Global Challenges

- **Stable ID:** `ap-spanish-language-unit-6`
- **Semester:** 2
- **Official canonical label:** Unit 6: Global Contexts
- **Canonical-label status:** official-label-differs-from-app-label
- **Practice page:** `ap-spanish-language/unit-6`
- **Content provenance:** app-unit-descriptions. The topic groups and keywords below are the app's paraphrased generation context, not a verbatim copy of the College Board CED. The linked CED remains the authority for exhaustive learning objectives and essential knowledge statements.
- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.
- **Unit sources:** [AP Spanish Language and Culture course page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture); [AP Spanish Language and Culture exam page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture/exam); [AP Spanish Language and Culture Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-spanish-language-and-culture-course-and-exam-description.pdf); `src/lib/data/ap-classes-data-08212026.json`.

## App MCQ contract

Storage: **Neon PostgreSQL**, table `content.mcq_questions`, payload field `data`, encoded as jsonb.

Required fields: `question`, `optionA`, `optionB`, `optionC`, `optionD`, `correctAnswer`, `explanation`, `hint1`, `hint2`, `topicsCovered`.
Optional fields: `diagram`.
Metadata fields: `apClass`, `unit`.
Correct-answer values: A, B, C, D. Additional properties allowed: false.

Generation rules:

- Stay strictly within the selected unit keywords and topics.
- Do not repeat recent topics when recent-topic context is available.
- Use original content and do not reconstruct an identifiable College Board question.
- Return only the validated JSON object.

Pool controls:

- `defaultMcqTarget`: 20
- `minMcqTarget`: 10
- `mcqTargetsByClass`: [object Object]
- `frqTarget`: 8
- `lowWaterRatio`: 0.9
- `maxGenerationsPerRun`: 5
- `leaseTtlMs`: 120000
- `retryDelayMs`: 60000
- `dailyLlmGenerationBudget`: 500
- `warmingRetryAfterSeconds`: 15
- `workerTimeBudgetMs`: 50000

## App FRQ contract and support

Storage: **Neon PostgreSQL**, table `content.frq_questions`, payload field `data`, encoded as jsonb.

Schema version: 1. Required fields: `schemaVersion`, `formatId`, `profileVersion`, `promptVersion`, `rubricVersion`, `prompt`, `materials`, `sections`, `rubric`, `totalPoints`, `topicsCovered`, `apClass`, `unit`.
Student-visible fields: `prompt`, `materials`, `sections`, `topicsCovered`, `apClass`, `unit`.
Private grading fields: `rubric`.

Validation rules:

- IDs use stable label characters and length limits.
- Section IDs and rubric criterion IDs are unique.
- Each criterion references a known section.
- Criterion levels have unique points including zero and reach maxPoints.
- Rubric total equals totalPoints.
- Each section rubric total equals section maxPoints.
- Responses are text-only and bounded by section and total character limits.

App FRQ profiles are currently enabled for: AP Biology, AP Calculus AB, AP English Language.

### AP Biology app FRQ profile

- Format: `scientific-analysis`
- Profile version: `biology-v1`
- Rubric version: `biology-rubric-v1`
- Supported response types: text
- Generation constraints: minSections=1; maxSections=12; maxMaterials=12
- Generation guidance: Create an original data-rich scientific analysis task focused on causal reasoning, evidence interpretation, and experimental or quantitative justification. Use text, Markdown tables, and LaTeX only.
- Grading guidance: Award points only for biologically correct claims connected to evidence or mechanisms; definitions alone do not earn application or reasoning points.

### AP Calculus AB app FRQ profile

- Format: `calculus-worked-response`
- Profile version: `calculus-ab-v1`
- Rubric version: `calculus-ab-rubric-v1`
- Supported response types: text
- Generation constraints: minSections=1; maxSections=12; maxMaterials=12
- Generation guidance: Create an original multi-part calculus task that rewards setup, mathematical reasoning, and interpretation separately. Use LaTeX and text only; do not require a hand-drawn graph.
- Grading guidance: Award method and setup credit independently from arithmetic accuracy when the rubric allows it; require mathematical justification when a conclusion depends on a theorem or sign analysis.

### AP English Language app FRQ profile

- Format: `argument-analysis`
- Profile version: `english-language-v1`
- Rubric version: `english-language-rubric-v1`
- Supported response types: text
- Generation constraints: minSections=1; maxSections=12; maxMaterials=12
- Generation guidance: Create an original short passage or source set and a single analytical or argumentative writing task. The material must be wholly original and must not imitate an identifiable published or exam passage.
- Grading guidance: Evaluate a defensible central claim, relevant evidence and reasoning, and control of the argument. Reward specific analysis rather than terminology alone.

The other 22 courses have official written-response or performance components where shown in their exam records, but their custom Free AP Practice FRQ generator is explicitly disabled: AP Chemistry, AP Physics 1, AP Physics 2, AP Physics C: Mechanics, AP Physics C: E&M, AP Environmental Science, AP Calculus BC, AP Statistics, AP Precalculus, AP Computer Science A, AP Computer Science Principles, AP English Literature, AP US History, AP World History, AP European History, AP US Government, AP Comparative Government, AP Psychology, AP Human Geography, AP Macroeconomics, AP Microeconomics, AP Spanish Language.

## Alignment findings and limitations

### AP Physics 2

Status: **has-app-catalog-differences**. The app contains an explicit knowledge-catalog override that differs from the base catalog file.

- knowledge-catalog-override in `src/lib/ap-knowledge/catalog.ts`.
  - App base labels: Unit 9: Thermodynamics; Unit 10: Electric Force, Field, and Potential; Unit 11: Electric Circuits; Unit 12: Magnetism and Electromagnetism; Unit 13: Electromagnetic Induction; Unit 14: Geometric Optics; Unit 15: Waves, Sound, and Physical Optics
  - Knowledge-catalog labels: Unit 9: Thermodynamics; Unit 10: Electric Force, Field, and Potential; Unit 11: Electric Circuits; Unit 12: Magnetism and Electromagnetism; Unit 13: Geometric Optics; Unit 14: Waves, Sound, and Physical Optics; Unit 15: Modern Physics

### AP Statistics

Status: **has-app-catalog-differences**. The app contains an explicit knowledge-catalog override that differs from the base catalog file.

- knowledge-catalog-override in `src/lib/ap-knowledge/catalog.ts`.
  - App base labels: Unit 1: Exploring One-Variable Data; Unit 2: Exploring Two-Variable Data; Unit 3: Collecting Data; Unit 4: Probability, Random Variables, and Probability Distributions; Unit 5: Sampling Distributions; Unit 6: Inference for Categorical Data: Proportions; Unit 7: Inference for Quantitative Data: Means; Unit 8: Inference for Categorical Data: Chi-Square; Unit 9: Inference for Quantitative Data: Slopes
  - Knowledge-catalog labels: Unit 1: Exploring One-Variable Data and Collecting Data; Unit 2: Probability, Random Variables, and Probability Distributions; Unit 3: Inference for Categorical Data: Proportions; Unit 4: Inference for Quantitative Data: Means; Unit 5: Regression Analysis

### AP Spanish Language

Status: **has-app-catalog-differences**. The app contains an explicit knowledge-catalog override that differs from the base catalog file.

- knowledge-catalog-override in `src/lib/ap-knowledge/catalog.ts`.
  - App base labels: Unit 1: Families and Communities; Unit 2: Personal and Public Identities; Unit 3: Beauty and Aesthetics; Unit 4: Science and Technology; Unit 5: Contemporary Life; Unit 6: Global Challenges
  - Knowledge-catalog labels: Unit 1: Families and Communities; Unit 2: Language and Culture; Unit 3: Art and Creativity; Unit 4: Science and Technology; Unit 5: Contemporary Life; Unit 6: Global Contexts

- The app currently has 179 base-catalog units. The knowledge catalog has explicit overrides for AP Physics 2, AP Statistics, and AP Spanish Language; the JSON preserves both values instead of silently choosing one.
- AP Statistics and AP Spanish Language have 2026–27 revised official frameworks/exams. AP Physics 2’s current official sequence also differs from the app base catalog in later unit labels.
- The JSON is a source-aware static snapshot. It does not replace live College Board pages, future CED revisions, the Neon question tables, or user attempt/history data.
- AP African American Studies was researched as an official AP course in the source work but is not included because it is not in the current Free AP Practice app catalog.

## Source registry

Every source ID referenced by the JSON resolves to an entry below. Official College Board sources are marked by their publisher; app sources point to repository files and are not treated as official AP authority.

| ID                                                   | Publisher        | Type                        | Supports                                                               | Link                                                                                                                                                                                       |
| ---------------------------------------------------- | ---------------- | --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cb-courses-index`                                   | College Board    | course-index                | course-list; official-course-names                                     | [AP Courses and Exams](https://apcentral.collegeboard.org/courses)                                                                                                                         |
| `cb-exam-timing-structure`                           | College Board    | exam-policy                 | general-exam-structure; multiple-choice-scoring; free-response-scoring | [AP Exam Timing and Structure](https://apstudents.collegeboard.org/ap-exams-what-to-know/exam-timing-structure)                                                                            |
| `cb-exam-scoring`                                    | College Board    | scoring-policy              | score-composition; multiple-choice-scoring; free-response-scoring      | [How AP Exams Are Scored](https://apstudents.collegeboard.org/help-center/how-are-ap-exams-scored)                                                                                         |
| `cb-course-audit`                                    | College Board    | course-policy               | course-framework-purpose; local-curriculum-flexibility                 | [About AP Course Audit](https://apcentral.collegeboard.org/courses/ap-course-audit/about)                                                                                                  |
| `cb-exam-development`                                | College Board    | assessment-policy           | assessment-design; question-types; pretesting                          | [AP Exam Development](https://apcentral.collegeboard.org/courses/how-ap-develops-courses-and-exams/exam-development)                                                                       |
| `cb-calculator-policy`                               | College Board    | exam-policy                 | calculator-permissions; calculator-prohibited-devices                  | [AP Exams Calculator Policy](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy)                                   |
| `cb-reference-information`                           | College Board    | exam-policy                 | equation-sheets; reference-tables; course-specific-reference-materials | [Reference Information for Specific AP Exams](https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/subject-specific/reference-information)           |
| `cb-past-exam-questions`                             | College Board    | released-assessment         | released-frqs; scoring-guidelines; sample-responses                    | [Past AP Exam Questions](https://apcentral.collegeboard.org/courses/past-exam-questions)                                                                                                   |
| `cb-course-changes`                                  | College Board    | course-policy               | ced-versioning; assessment-change-policy                               | [AP Course and Exam Changes](https://apcentral.collegeboard.org/courses/how-ap-develops-courses-and-exams/course-changes-overview)                                                         |
| `cb-history-2027-updates`                            | College Board    | exam-update                 | history-exam-updates-2027; history-saq; history-leq                    | [AP History Exam Updates](https://apcentral.collegeboard.org/courses/ap-history-exam-updates)                                                                                              |
| `app-ap-classes`                                     | Free AP Practice | app-source                  | app-course-catalog; app-unit-labels                                    | `src/lib/data/ap-classes-data-08212026.json`                                                                                                                                               |
| `app-unit-descriptions`                              | Free AP Practice | app-source                  | mcq-unit-context; course-guidance; unit-topics; unit-keywords          | `src/lib/data/ap-classes-data-08212026.json`                                                                                                                                               |
| `app-practice-pages`                                 | Free AP Practice | app-source                  | seo-content; unit-page-content; class-page-content                     | `src/lib/data/ap-classes-data-08212026.json`                                                                                                                                               |
| `app-question-pool-targets`                          | Free AP Practice | app-source                  | pool-targets                                                           | `src/lib/data/ap-classes-data-08212026.json`                                                                                                                                               |
| `app-mcq-generation`                                 | Free AP Practice | app-source                  | mcq-schema; mcq-generation-rules; unit-scope-rules                     | `src/lib/question-bank/mcq/generation.server.ts`                                                                                                                                           |
| `app-frq-types`                                      | Free AP Practice | app-source                  | frq-schema; frq-rubric-rules; frq-response-limits                      | `src/lib/question-bank/frq/types.ts`                                                                                                                                                       |
| `app-frq-profiles`                                   | Free AP Practice | app-source                  | app-frq-support; frq-generation-guidance; frq-grading-guidance         | `src/lib/question-bank/frq/profiles.server.ts`                                                                                                                                             |
| `app-neon-content-schema`                            | Free AP Practice | app-source                  | question-storage; jsonb-question-payloads                              | `src/lib/server/neon/schema/content.ts`                                                                                                                                                    |
| `app-ap-knowledge-catalog`                           | Free AP Practice | app-source                  | knowledge-catalog-overrides; official-source-links                     | `src/lib/ap-knowledge/catalog.ts`                                                                                                                                                          |
| `cb-course-ap-biology`                               | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Biology course page](https://apcentral.collegeboard.org/courses/ap-biology)                                                                                                            |
| `cb-exam-ap-biology`                                 | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Biology exam page](https://apcentral.collegeboard.org/courses/ap-biology/exam)                                                                                                         |
| `cb-ced-ap-biology`                                  | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Biology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf)                                                          |
| `cb-course-ap-chemistry`                             | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Chemistry course page](https://apcentral.collegeboard.org/courses/ap-chemistry)                                                                                                        |
| `cb-exam-ap-chemistry`                               | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Chemistry exam page](https://apcentral.collegeboard.org/courses/ap-chemistry/exam)                                                                                                     |
| `cb-ced-ap-chemistry`                                | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Chemistry Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf)                                                      |
| `cb-course-ap-physics-1`                             | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Physics 1: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-1)                                                                                         |
| `cb-exam-ap-physics-1`                               | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Physics 1: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-1/exam)                                                                                      |
| `cb-ced-ap-physics-1`                                | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Physics 1: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-1-course-and-exam-description.pdf)                                       |
| `cb-course-ap-physics-2`                             | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Physics 2: Algebra-Based course page](https://apcentral.collegeboard.org/courses/ap-physics-2)                                                                                         |
| `cb-exam-ap-physics-2`                               | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Physics 2: Algebra-Based exam page](https://apcentral.collegeboard.org/courses/ap-physics-2/exam)                                                                                      |
| `cb-ced-ap-physics-2`                                | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Physics 2: Algebra-Based Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-2-course-and-exam-description.pdf)                                       |
| `cb-course-ap-physics-c-mechanics`                   | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Physics C: Mechanics course page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics)                                                                                   |
| `cb-exam-ap-physics-c-mechanics`                     | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Physics C: Mechanics exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics/exam)                                                                                |
| `cb-ced-ap-physics-c-mechanics`                      | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Physics C: Mechanics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-mechanics-course-and-exam-description.pdf)                                 |
| `cb-course-ap-physics-c-electricity-and-magnetism`   | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Physics C: Electricity and Magnetism course page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism)                                                   |
| `cb-exam-ap-physics-c-electricity-and-magnetism`     | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Physics C: Electricity and Magnetism exam page](https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism/exam)                                                |
| `cb-ced-ap-physics-c-electricity-and-magnetism`      | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Physics C: Electricity and Magnetism Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-physics-c-electricity-and-magnetism-course-and-exam-description.pdf) |
| `cb-course-ap-environmental-science`                 | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Environmental Science course page](https://apcentral.collegeboard.org/courses/ap-environmental-science)                                                                                |
| `cb-exam-ap-environmental-science`                   | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Environmental Science exam page](https://apcentral.collegeboard.org/courses/ap-environmental-science/exam)                                                                             |
| `cb-ced-ap-environmental-science`                    | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Environmental Science Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-environmental-science-course-and-exam-description.pdf)                              |
| `cb-course-ap-calculus-ab`                           | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Calculus AB course page](https://apcentral.collegeboard.org/courses/ap-calculus-ab)                                                                                                    |
| `cb-exam-ap-calculus-ab`                             | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Calculus AB exam page](https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam)                                                                                                 |
| `cb-ced-ap-calculus-ab`                              | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Calculus AB Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-course-and-exam-description.pdf)                                                  |
| `cb-course-ap-calculus-bc`                           | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Calculus BC course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc)                                                                                                    |
| `cb-exam-ap-calculus-bc`                             | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Calculus BC exam page](https://apcentral.collegeboard.org/courses/ap-calculus-bc/exam)                                                                                                 |
| `cb-ced-ap-calculus-bc`                              | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Calculus BC Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-calculus-bc-course-and-exam-description.pdf)                                                  |
| `cb-course-ap-statistics`                            | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Statistics course page](https://apcentral.collegeboard.org/courses/ap-statistics)                                                                                                      |
| `cb-exam-ap-statistics`                              | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Statistics exam page](https://apcentral.collegeboard.org/courses/ap-statistics/exam)                                                                                                   |
| `cb-ced-ap-statistics`                               | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Statistics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf)                                                    |
| `cb-course-ap-precalculus`                           | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Precalculus course page](https://apcentral.collegeboard.org/courses/ap-precalculus)                                                                                                    |
| `cb-exam-ap-precalculus`                             | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Precalculus exam page](https://apcentral.collegeboard.org/courses/ap-precalculus/exam)                                                                                                 |
| `cb-ced-ap-precalculus`                              | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Precalculus Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-precalculus-course-and-exam-description.pdf)                                                  |
| `cb-course-ap-computer-science-a`                    | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Computer Science A course page](https://apcentral.collegeboard.org/courses/ap-computer-science-a)                                                                                      |
| `cb-exam-ap-computer-science-a`                      | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Computer Science A exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam)                                                                                   |
| `cb-ced-ap-computer-science-a`                       | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Computer Science A Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description.pdf)                                    |
| `cb-course-ap-computer-science-principles`           | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Computer Science Principles course page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles)                                                                    |
| `cb-exam-ap-computer-science-principles`             | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Computer Science Principles exam page](https://apcentral.collegeboard.org/courses/ap-computer-science-principles/exam)                                                                 |
| `cb-ced-ap-computer-science-principles`              | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Computer Science Principles Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-course-and-exam-description.pdf)                  |
| `cb-course-ap-english-language-and-composition`      | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP English Language and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition)                                                          |
| `cb-exam-ap-english-language-and-composition`        | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP English Language and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam)                                                       |
| `cb-ced-ap-english-language-and-composition`         | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP English Language and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-language-and-composition-course-and-exam-description.pdf)        |
| `cb-course-ap-english-literature-and-composition`    | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP English Literature and Composition course page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition)                                                      |
| `cb-exam-ap-english-literature-and-composition`      | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP English Literature and Composition exam page](https://apcentral.collegeboard.org/courses/ap-english-literature-and-composition/exam)                                                   |
| `cb-ced-ap-english-literature-and-composition`       | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP English Literature and Composition Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-english-literature-and-composition-course-and-exam-description.pdf)    |
| `cb-course-ap-united-states-history`                 | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP United States History course page](https://apcentral.collegeboard.org/courses/ap-united-states-history)                                                                                |
| `cb-exam-ap-united-states-history`                   | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP United States History exam page](https://apcentral.collegeboard.org/courses/ap-united-states-history/exam)                                                                             |
| `cb-ced-ap-united-states-history`                    | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP United States History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf)                                         |
| `cb-course-ap-world-history`                         | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP World History: Modern course page](https://apcentral.collegeboard.org/courses/ap-world-history)                                                                                        |
| `cb-exam-ap-world-history`                           | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP World History: Modern exam page](https://apcentral.collegeboard.org/courses/ap-world-history/exam)                                                                                     |
| `cb-ced-ap-world-history`                            | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP World History: Modern Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description-effective-fall-2026.pdf)           |
| `cb-course-ap-european-history`                      | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP European History course page](https://apcentral.collegeboard.org/courses/ap-european-history)                                                                                          |
| `cb-exam-ap-european-history`                        | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP European History exam page](https://apcentral.collegeboard.org/courses/ap-european-history/exam)                                                                                       |
| `cb-ced-ap-european-history`                         | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP European History Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf)                                        |
| `cb-course-ap-united-states-government-and-politics` | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP United States Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics)                                                |
| `cb-exam-ap-united-states-government-and-politics`   | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP United States Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-united-states-government-and-politics/exam)                                             |
| `cb-ced-ap-united-states-government-and-politics`    | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP United States Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-us-government-and-politics-course-and-exam-description.pdf)         |
| `cb-course-ap-comparative-government-and-politics`   | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Comparative Government and Politics course page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics)                                                    |
| `cb-exam-ap-comparative-government-and-politics`     | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Comparative Government and Politics exam page](https://apcentral.collegeboard.org/courses/ap-comparative-government-and-politics/exam)                                                 |
| `cb-ced-ap-comparative-government-and-politics`      | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Comparative Government and Politics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-comparative-government-and-politics-course-and-exam-description.pdf)  |
| `cb-course-ap-psychology`                            | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Psychology course page](https://apcentral.collegeboard.org/courses/ap-psychology)                                                                                                      |
| `cb-exam-ap-psychology`                              | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Psychology exam page](https://apcentral.collegeboard.org/courses/ap-psychology/exam)                                                                                                   |
| `cb-ced-ap-psychology`                               | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Psychology Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-psychology-course-and-exam-description.pdf)                                                    |
| `cb-course-ap-human-geography`                       | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Human Geography course page](https://apcentral.collegeboard.org/courses/ap-human-geography)                                                                                            |
| `cb-exam-ap-human-geography`                         | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Human Geography exam page](https://apcentral.collegeboard.org/courses/ap-human-geography/exam)                                                                                         |
| `cb-ced-ap-human-geography`                          | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Human Geography Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf)                                          |
| `cb-course-ap-macroeconomics`                        | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Macroeconomics course page](https://apcentral.collegeboard.org/courses/ap-macroeconomics)                                                                                              |
| `cb-exam-ap-macroeconomics`                          | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Macroeconomics exam page](https://apcentral.collegeboard.org/courses/ap-macroeconomics/exam)                                                                                           |
| `cb-ced-ap-macroeconomics`                           | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Macroeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-macroeconomics-course-and-exam-description.pdf)                                            |
| `cb-course-ap-microeconomics`                        | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Microeconomics course page](https://apcentral.collegeboard.org/courses/ap-microeconomics)                                                                                              |
| `cb-exam-ap-microeconomics`                          | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Microeconomics exam page](https://apcentral.collegeboard.org/courses/ap-microeconomics/exam)                                                                                           |
| `cb-ced-ap-microeconomics`                           | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Microeconomics Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf)                                            |
| `cb-course-ap-spanish-language-and-culture`          | College Board    | course-page                 | course-overview; course-framework; unit-list; unit-weighting; ced-link | [AP Spanish Language and Culture course page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture)                                                                  |
| `cb-exam-ap-spanish-language-and-culture`            | College Board    | exam-page                   | exam-format; exam-timing; exam-weighting; frq-types; calculator-policy | [AP Spanish Language and Culture exam page](https://apcentral.collegeboard.org/courses/ap-spanish-language-and-culture/exam)                                                               |
| `cb-ced-ap-spanish-language-and-culture`             | College Board    | course-and-exam-description | course-framework; unit-topics; unit-weighting; skills; exam-task-types | [AP Spanish Language and Culture Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-spanish-language-and-culture-course-and-exam-description.pdf)                |

## Validation snapshot

The artifact was generated from the current repository sources and validated with `scripts/validate-ap-classes-data.ts`. Expected invariants: **25 courses**, **179 units**, **204 practice pages**, unique course/unit IDs, exact current app labels/order, resolvable practice pages, resolvable source references, synchronized FRQ profiles, and no embedded question instances.

End of report.
