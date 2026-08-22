# AP Classes Super-Data JSON: Schema Plan

Date: 2026-08-21  
Canonical artifact: `src/lib/data/ap-classes-data-08212026.json`

## Purpose

Create one versioned, source-aware dataset for every AP course currently supported by Free AP Practice. The dataset should be able to drive catalog navigation, MCQ generation context, FRQ generation metadata, exam-format displays, content QA, and source auditing without losing the distinction between:

1. official College Board facts;
2. the app's current catalog and product behavior; and
3. generated question storage and runtime contracts.

The file is a curated configuration and knowledge artifact. It is not a dump of every generated question. MCQs and FRQs are generated and stored in Neon, so the unified file describes their schemas, generation rules, course support, and pool configuration while keeping question instances in the database.

## Design principles

- Stable IDs are machine-readable slugs, not display labels.
- Display labels preserve the exact strings currently used by the app so existing lookups remain deterministic.
- Official curriculum and assessment facts are paraphrased and source-linked rather than copied from College Board publications.
- Every researched claim can point to one or more entries in the top-level `sources` registry.
- Course-level and unit-level sources are explicit; a source should not be inferred solely from a URL pattern.
- Official exam structure is separate from app practice support. A course can have an official FRQ while the app's custom FRQ generator is disabled for that course.
- A course/unit can record alignment issues between the current app catalog and the current official source instead of silently overwriting either value.
- Rules are structured where the app needs to enforce them and human-readable where they are guidance for generation or grading.
- The schema is additive and versioned. Unknown future fields should be ignored by readers; required fields should remain small and stable.

## Proposed top-level shape

```json
{
	"schemaVersion": "2.0.0",
	"datasetId": "freeappractice.ap-classes",
	"datasetVersion": "2026-08-21",
	"generatedAt": "2026-08-21T00:00:00Z",
	"asOf": "2026-08-21",
	"scope": {
		"appCourseCount": 25,
		"appUnitCount": 179,
		"includesAllCurrentlySupportedAppCourses": true,
		"questionInstancesIncluded": false
	},
	"sources": [],
	"globalRules": {},
	"examFramework": {},
	"questionBank": {},
	"courses": [],
	"pages": []
}
```

## Top-level fields

### `sources`

The canonical source registry. Each source should have:

```json
{
	"id": "cb-ap-biology-course-page",
	"publisher": "College Board",
	"title": "AP Biology Course",
	"url": "https://apcentral.collegeboard.org/courses/ap-biology",
	"sourceType": "course-page",
	"official": true,
	"accessedAt": "2026-08-21",
	"supports": ["course.overview", "course.units", "exam.sources"],
	"notes": "Use the linked current official page for revisions after this snapshot."
}
```

`sourceType` should distinguish `course-page`, `course-and-exam-description`, `exam-page`, `scoring-guidelines`, `chief-reader-report`, `app-source`, and `other-official`. App-owned sources should be marked `official: false` and should never be presented as College Board authority.

### `globalRules`

Cross-course invariants and product rules:

```json
{
	"catalog": {
		"courseNameIsDisplayKey": true,
		"unitLabelFormat": "Unit {number}: {title}",
		"unknownCourseBehavior": "reject"
	},
	"contentPolicy": {
		"mustBeOriginal": true,
		"mustNotReconstructIdentifiableExamContent": true,
		"mustCiteOfficialSourceForOfficialClaim": true
	},
	"generation": {
		"mcqMustStayWithinSelectedUnitTopics": true,
		"frqMustUseCourseProfile": true,
		"recentTopicDiversityIsRequired": true
	}
}
```

### `examFramework`

Reusable vocabulary and normalized assessment concepts. This should contain definitions for `multiple-choice`, `free-response`, `calculator-policy`, `stimulus`, `short-answer`, `argumentative-essay`, `document-based-question`, `long-essay`, `investigative-task`, and other formats needed by the course records. It should not force every course into the same shape; course-specific sections may add fields.

### `questionBank`

The app runtime contract, not the question rows themselves:

```json
{
	"mcq": {
		"storage": {
			"database": "Neon PostgreSQL",
			"table": "content.mcq_questions",
			"payloadField": "data",
			"payloadEncoding": "jsonb"
		},
		"schema": {
			"requiredFields": [
				"question",
				"optionA",
				"optionB",
				"optionC",
				"optionD",
				"correctAnswer",
				"explanation",
				"hint1",
				"hint2",
				"topicsCovered"
			],
			"optionalFields": ["diagram"],
			"correctAnswerValues": ["A", "B", "C", "D"],
			"requiredMetadata": ["apClass", "unit"]
		},
		"generationRules": [],
		"poolRules": {}
	},
	"frq": {
		"storage": {
			"database": "Neon PostgreSQL",
			"table": "content.frq_questions",
			"payloadField": "data",
			"payloadEncoding": "jsonb"
		},
		"schema": {
			"requiredFields": [
				"schemaVersion",
				"formatId",
				"profileVersion",
				"promptVersion",
				"rubricVersion",
				"prompt",
				"materials",
				"sections",
				"rubric",
				"totalPoints",
				"topicsCovered",
				"apClass",
				"unit"
			],
			"studentVisibleFields": [
				"prompt",
				"materials",
				"sections",
				"topicsCovered",
				"apClass",
				"unit"
			],
			"privateGradingFields": ["rubric"],
			"generationRules": [],
			"gradingRules": []
		}
	}
}
```

### `courses`

One record per currently supported app course. The course record should contain:

```json
{
	"id": "ap-biology",
	"name": "AP Biology",
	"app": {
		"supported": true,
		"practice": {
			"mcq": { "enabled": true },
			"frq": { "enabled": true },
			"classPageId": "ap-biology"
		}
	},
	"official": {
		"courseOverview": "Paraphrased, source-backed course scope.",
		"skills": [],
		"exam": {},
		"sources": []
	},
	"generation": {
		"courseGuidance": [],
		"mcq": {},
		"frq": {}
	},
	"units": [],
	"alignment": {
		"status": "aligned",
		"notes": [],
		"differences": []
	},
	"sources": []
}
```

## Course exam shape

`official.exam` should normalize what can be compared across courses while retaining course-specific assessment details:

```json
{
	"examYearContext": "2026",
	"totalDurationMinutes": 180,
	"totalScoreWeightPercent": 100,
	"sections": [
		{
			"id": "multiple-choice",
			"label": "Multiple Choice",
			"questionCount": 60,
			"durationMinutes": 90,
			"weightPercent": 50,
			"calculatorPolicy": "course-specific value",
			"stimulusPolicy": "course-specific description",
			"questionTypes": ["single-select"]
		},
		{
			"id": "free-response",
			"label": "Free Response",
			"durationMinutes": 90,
			"weightPercent": 50,
			"questionTypes": ["course-specific format"],
			"parts": []
		}
	],
	"scoring": {
		"rawScoreNotes": [],
		"reportedScoreNotes": [],
		"sourceIds": []
	},
	"sources": []
}
```

The actual values must be researched per course from the current official exam page and/or current Course and Exam Description. Do not use this sample's Biology-like numbers for every course.

## Unit shape

Each unit should preserve the app label and hold structured curriculum, practice, and source data:

```json
{
	"id": "ap-biology-unit-1",
	"number": 1,
	"label": "Unit 1: Chemistry of Life",
	"app": {
		"semester": 1,
		"practicePageId": "ap-biology/unit-1"
	},
	"official": {
		"description": "Paraphrased unit scope.",
		"weightRangePercent": { "min": 8, "max": 11 },
		"topics": [
			{
				"id": "ap-biology-u1-topic-1",
				"number": "1.1",
				"title": "Topic title",
				"description": "Paraphrased topic scope.",
				"knowledgeAndSkills": [],
				"skills": [],
				"sources": []
			}
		],
		"commonSkills": [],
		"sources": []
	},
	"generation": {
		"mcq": {
			"enabled": true,
			"keywords": [],
			"constraints": [],
			"avoid": []
		},
		"frq": {
			"officiallyAssessed": true,
			"appEnabled": true,
			"allowedTaskTypes": [],
			"generationGuidance": [],
			"gradingGuidance": []
		}
	},
	"sources": []
}
```

### `pages`

Practice-page content is stored once in the top-level page index. Courses reference their class page with `app.practice.classPageId`, and units reference unit pages with `app.practicePageId`. A page uses `courseId` and, for unit pages, `unitId` instead of repeating display names.

```json
{
	"id": "ap-biology/unit-1",
	"type": "unit",
	"courseId": "ap-biology",
	"unitId": "ap-biology-unit-1",
	"seo": {},
	"article": {},
	"links": []
}
```

## FRQ representation

There are two separate FRQ layers:

1. `official.exam.sections` describes the College Board's actual exam FRQ task types, timing, weighting, and scoring structure.
2. `generation.frq` describes Free AP Practice's custom FRQ support, including `appEnabled`, `formatId`, `profileVersion`, `rubricVersion`, response types, material/section constraints, generation guidance, and grading guidance.

For courses without an app FRQ profile, retain the official FRQ record and set `appEnabled: false` with an explicit `unsupportedByAppReason`. Do not manufacture an app profile merely because the official exam has an FRQ.

## Source attribution rules

- Official course, unit, exam, calculator, timing, weighting, and scoring claims require a College Board source ID.
- App behavior claims require an app source ID pointing to a repository file or schema.
- A unit record's `sources` should include the source IDs supporting its description, topics, weighting, and assessment claims.
- When one source supports only part of a record, use field-level `sourceIds` rather than implying it supports the entire record.
- Record the access date and an `asOf` date for facts likely to change.
- Use concise paraphrases. Do not include full copyrighted exam questions, passages, scoring guidelines, or CED text.

## Validation requirements

The completed artifact must validate that:

1. There are exactly 25 courses and every course name in the unified app catalog is present.
2. Every current app unit label appears exactly once under its course, for 179 total units.
3. Every unit ID and course ID is unique.
4. Every `practicePageId` and `classPageId` resolves to one page in the normalized top-level `pages` index.
5. Every referenced source ID exists in the top-level source registry.
6. Every supported app FRQ profile is represented exactly once, and unsupported courses are explicit rather than omitted.
7. MCQ and FRQ schema declarations match the current TypeScript validation/storage contracts.
8. Official claims have official source IDs; app-specific behavior is not presented as official policy.
9. The file parses as strict JSON and contains no generated question instances or private user data.

## Planned deliverables

- `docs/research/ap-classes-data-schema-plan-2026-08-21.md` - this design and validation contract.
- `src/lib/data/ap-classes-data-08212026.json` - the consolidated source-aware dataset.
- `docs/research/ap-exams-full-content-2026-08-21.md` - the detailed source-backed research report.
- A focused validation script or command output documenting course/unit counts, source references, and schema invariants.

## Implemented snapshot notes

The generated `1.0.0` artifact follows this plan with two deliberate clarifications:

- Each course has a direct College Board course-page source, exam-page source, and Course and Exam Description source. Shared calculator, reference-material, scoring, timing, and released-assessment sources are also registered centrally.
- Unit `official.topicGroups` are explicitly marked with `contentProvenance: "app-unit-descriptions"`. They preserve the app's paraphrased generation context without presenting it as a verbatim CED transcription. The official framework labels, alignment status, exam structure, and CED links are stored alongside that app context.
- AP Physics 2, AP Statistics, and AP Spanish Language preserve both the current base app catalog and the differing knowledge-catalog/current-framework labels. AP Statistics additionally marks legacy app-only units that are not present in the revised five-unit framework.
- `scripts/validate-ap-classes-data.ts` validates the final counts, labels/order, unique IDs, practice-page references, source references, FRQ profile synchronization, MCQ contract fields, and question-instance exclusion rule.
