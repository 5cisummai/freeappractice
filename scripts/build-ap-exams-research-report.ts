import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import dataset from '../src/lib/data/ap-classes-data-08212026.json';

type Source = (typeof dataset.sources)[number];
type Course = (typeof dataset.courses)[number];
type Unit = Course['units'][number];
type ExamSection = {
	id: string;
	label: string;
	questionCount?: number;
	durationMinutes?: number;
	durationRangeMinutes?: { min: number; max: number };
	weightPercent?: number;
	calculatorPolicy?: string;
	questionTypes?: string[];
	parts?: Array<Record<string, unknown>>;
	notes?: string[];
};

const OUTPUT = resolve('docs/research/ap-exams-full-content-2026-08-21.md');
const sourceById = new Map(dataset.sources.map((source) => [source.id, source] as const));
const lines: string[] = [];

function sourceLink(id: string): string {
	const source = sourceById.get(id);
	if (!source) return `\`${id}\``;
	if (!source.url.startsWith('http')) return `\`${source.url}\``;
	return `[${source.title}](${source.url})`;
}

function sourceLinks(ids: string[]): string {
	return ids.map(sourceLink).join('; ');
}

function inline(value: unknown): string {
	return String(value ?? '')
		.replace(/\|/g, '\\|')
		.replace(/\r?\n/g, ' ')
		.trim();
}

function sectionShort(section: ExamSection): string {
	const count = section.questionCount
		? `${section.questionCount} questions`
		: 'through-course task';
	const duration = section.durationRangeMinutes
		? `${section.durationRangeMinutes.min}–${section.durationRangeMinutes.max} min`
		: section.durationMinutes
			? `${section.durationMinutes} min`
			: 'separate deadline';
	const weight = section.weightPercent ? `${section.weightPercent}%` : 'part of task';
	return `${inline(section.label)}: ${count}; ${duration}; ${weight}`;
}

function sectionLong(section: ExamSection): string[] {
	const output = [
		`**${inline(section.label)}** - ${section.questionCount ? `${section.questionCount} questions` : 'through-course component'}; ${section.durationRangeMinutes ? `${section.durationRangeMinutes.min}–${section.durationRangeMinutes.max} minutes` : section.durationMinutes ? `${section.durationMinutes} minutes` : 'administered separately'}; ${section.weightPercent ? `${section.weightPercent}% of the exam score` : 'weight described in the course framework'}.`
	];
	if (section.questionTypes?.length)
		output.push(`Question/task types: ${section.questionTypes.map(inline).join('; ')}.`);
	if (section.calculatorPolicy)
		output.push(`Calculator policy: ${inline(section.calculatorPolicy)}.`);
	for (const note of section.notes ?? []) output.push(`Note: ${inline(note)}`);
	for (const part of section.parts ?? []) {
		const details = Object.entries(part)
			.filter(([key]) => key !== 'id')
			.map(([key, value]) => `${key}=${inline(value)}`)
			.join('; ');
		output.push(`Part **${inline(part.id)}**: ${details}.`);
	}
	return output;
}

function appFrqStatus(course: Course): string {
	if (course.app.practice.frq.enabled) return `enabled (${course.app.practice.frq.profileId})`;
	return 'disabled in the current app';
}

function currentAppTopicCount(): number {
	return dataset.courses.reduce(
		(total, course) =>
			total +
			course.units.reduce((unitTotal, unit) => unitTotal + unit.official.topicGroups.length, 0),
		0
	);
}

function currentAppKeywordCount(): number {
	return dataset.courses.reduce(
		(total, course) =>
			total +
			course.units.reduce((unitTotal, unit) => unitTotal + unit.official.focusKeywords.length, 0),
		0
	);
}

function push(value = ''): void {
	lines.push(value);
}

push('# AP exam, course, unit, and question-bank research');
push('');
push(`Snapshot date: **${dataset.asOf}**  `);
push('Artifact: `src/lib/data/ap-classes-data-08212026.json`  ');
push('Schema: `1.0.0`  ');
push(
	'Research boundary: current AP courses supported by Free AP Practice, with official College Board sources accessed on 2026-08-21.'
);
push('');
push('## Executive summary');
push('');
push(
	`This report consolidates the current app catalog and the source-backed AP assessment research into one auditable snapshot. It covers **${dataset.scope.appCourseCount} courses**, **${dataset.scope.appUnitCount} app units**, **${dataset.scope.practicePageCount} practice pages**, **${currentAppTopicCount()} app topic entries**, and **${currentAppKeywordCount()} app keyword entries**. The dataset contains **${dataset.sources.length} source records** and deliberately contains no generated question instances or user data. The former standalone app data files are now represented as typed sections of this unified artifact.`
);
push('');
push('The artifact keeps three layers separate:');
push('');
push(
	'- **Official AP layer:** College Board course pages, Course and Exam Descriptions, exam pages, calculator/reference policies, revision notices, and released-assessment indexes.'
);
push(
	'- **App layer:** the exact course/unit labels, semester placement, practice-page content, app-authored generation controls, MCQ prompt contract, FRQ profiles, and pool targets currently used by Free AP Practice.'
);
push(
	'- **Runtime storage layer:** the Neon PostgreSQL JSONB schemas and metadata contracts used for generated MCQs and FRQs. The generated rows remain in the database and are described, not copied, here.'
);
push('');
push('### Reading the unit records');
push('');
push(
	'The report intentionally omits unit descriptions, topic lists, and focus keywords from the public research artifact. Runtime generation uses only app-authored controls; official course and assessment claims remain linked to their source IDs. Use the linked CED for exhaustive learning objectives and essential knowledge statements.'
);
push('');
push('## Repository audit and consolidation map');
push('');
push('| Unified dataset section | What the unified artifact provides |');
push('| --- | --- |');
push(
	'| `courses[].app.catalog` | Exact current course names, semester 1/2 unit labels, order, and app unit count. |'
);
push(
	'| `courses[].generation` and `courses[].units[].generation.mcq` | App-authored course and unit generation controls. |'
);
push(
	'| `courses[].app.practice` and `courses[].units[].app.pageContent` | Class/unit SEO records, article paragraphs, links, and page slugs under each course/unit. |'
);
push('| `questionBank.mcq.poolRules` | MCQ target configuration and FRQ pool target. |');
push(
	'| `src/lib/question-bank/mcq/generation.server.ts` | MCQ schema, strict unit-scope rules, originality rules, output contract, and generation controls. |'
);
push(
	'| `src/lib/question-bank/frq/types.ts` | FRQ schema version, materials/sections/rubric structure, limits, and validation rules. |'
);
push(
	'| `src/lib/question-bank/frq/profiles.server.ts` | The three currently enabled app FRQ profiles and explicit disabled status for the other courses. |'
);
push(
	'| `src/lib/server/neon/schema/content.ts` | Neon tables, JSONB payload locations, and the distinction between content rows and this static catalog artifact. |'
);
push(
	'| `src/lib/ap-knowledge/catalog.ts` | Explicit alignment records for AP Physics 2, AP Statistics, and AP Spanish Language catalog overrides. |'
);
push('');
push('## Cross-course official exam rules');
push('');
push(
	`- Multiple-choice scoring is based on correct responses; free-response and performance work use course-specific criteria; component results are combined into a 1–5 AP score through College Board scoring processes. See ${sourceLinks(dataset.examFramework.generalSources)}.`
);
push(
	`- Hybrid exams use Bluebook for the digital portion and paper booklets for handwritten free responses. Fully digital exams submit all documented responses in Bluebook. The app records delivery mode per course rather than assuming one format for every AP exam.`
);
push(
	`- Calculator permissions are course-specific. Section-specific mathematics rules are stored on exam parts where applicable. Students must follow the current ${sourceLink('cb-calculator-policy')}, including its restrictions on phones, smartwatches, QWERTY devices, wireless-enabled devices, and camera-capable devices.`
);
push(
	`- Course-specific equation sheets, tables, Java references, and other materials are represented in each exam record and should be checked against ${sourceLink('cb-reference-information')} before student-facing copy is generated.`
);
push(
	`- ${sourceLink('cb-past-exam-questions')} was used for format and scoring research only. No released AP question, passage, rubric text, or answer key is reproduced in the JSON or this report.`
);
push('');
push('## Exam-format matrix');
push('');
push(
	'| Course | App units | Official framework units | Delivery | Section I | Section II / through-course component | App FRQ |'
);
push('| --- | ---: | ---: | --- | --- | --- | --- |');
for (const course of dataset.courses) {
	const sections = course.official.exam.sections;
	const first = sections[0];
	const rest = sections.slice(1);
	push(
		`| ${inline(course.name)} | ${course.app.catalog.unitCount} | ${course.official.framework.unitCount} | ${inline(course.official.exam.deliveryMode)} | ${inline(sectionShort(first))} | ${rest.map(sectionShort).join('<br>')} | ${inline(appFrqStatus(course))} |`
	);
}
push('');
push('## Course-by-course research');
push('');
push(
	'Each course section below includes the current app unit inventory, official exam structure, skills, revision notes, and source links. Generation prompts use app-authored controls that are intentionally not reproduced here.'
);
push('');

for (const course of dataset.courses) {
	const officialSourceIds = course.official.sourceIds.filter((id) => id.startsWith('cb-'));
	const appSourceIds = course.sources.filter((id) => id.startsWith('app-'));
	push(`### ${course.name}`);
	push('');
	push(`**Official name:** ${inline(course.official.name)}  `);
	push(`**Category:** ${inline(course.official.category)}  `);
	push(`**Current app units:** ${course.app.catalog.unitCount}  `);
	push(`**Official framework units in this snapshot:** ${course.official.framework.unitCount}  `);
	push(`**Delivery:** ${inline(course.official.exam.deliveryMode)}  `);
	push(`**App FRQ:** ${inline(appFrqStatus(course))}`);
	push('');
	push(
		`Official framework labels: ${course.official.framework.unitLabels.map(inline).join('; ')}.`
	);
	push(`Official framework alignment: ${inline(course.official.framework.alignment)}.`);
	push(`Skills: ${course.official.skills.map(inline).join('; ')}.`);
	push(`Official sources: ${sourceLinks(officialSourceIds)}.`);
	if (appSourceIds.length) push(`App sources: ${sourceLinks(appSourceIds)}.`);
	push('');
	push('#### Exam details');
	push('');
	const totalDuration = course.official.exam.totalDurationRangeMinutes
		? `${course.official.exam.totalDurationRangeMinutes.min}–${course.official.exam.totalDurationRangeMinutes.max}`
		: (course.official.exam.totalDurationMinutes ?? 'course-specific / separately administered');
	push(
		`Exam duration in the snapshot: ${totalDuration} minutes. Calculator policy: ${inline(course.official.exam.calculatorPolicy)}.`
	);
	for (const section of course.official.exam.sections) {
		for (const detail of sectionLong(section)) push(`- ${detail}`);
	}
	if (course.official.exam.referenceMaterials?.length)
		push(`Reference materials: ${course.official.exam.referenceMaterials.map(inline).join('; ')}.`);
	for (const note of course.official.exam.assessmentNotes)
		push(`- Assessment note: ${inline(note)}`);
	for (const update of course.official.exam.updatesFor2026_27 ?? [])
		push(`- 2026–27 update: ${inline(update)}`);
	push('');
	push('#### Current app units and source context');
	push('');
	for (const unit of course.units) {
		const sourceIds = unit.sources.filter(
			(id) => id.startsWith('cb-') || id === 'app-unit-descriptions'
		);
		push(`##### ${unit.label}`);
		push('');
		push(`- **Stable ID:** \`${unit.id}\``);
		push(`- **Semester:** ${unit.app.semester}`);
		push(
			`- **Official canonical label:** ${unit.official.canonicalLabel ? inline(unit.official.canonicalLabel) : 'none in the current official framework; retained as an app-only/legacy label'}`
		);
		push(`- **Canonical-label status:** ${inline(unit.official.canonicalLabelStatus)}`);
		push(`- **Practice page:** \`${unit.app.practicePageSlug ?? 'not present'}\``);
		if (unit.official.weightRangePercent)
			push(
				`- **App page’s published multiple-choice weight range:** ${unit.official.weightRangePercent.min}%–${unit.official.weightRangePercent.max}%.`
			);
		push(
			`- **Content provenance:** ${inline(unit.official.contentProvenance)}. ${inline(unit.official.coverageNote)}`
		);
		push(
			'- **Generation context:** app-authored controls are stored in the dataset but are not reproduced in this public research report.'
		);
		push(`- **Unit sources:** ${sourceLinks(sourceIds)}.`);
	}
	push('');
}

push('## App MCQ contract');
push('');
push(
	`Storage: **${dataset.questionBank.mcq.storage.database}**, table \`${dataset.questionBank.mcq.storage.table}\`, payload field \`${dataset.questionBank.mcq.storage.payloadField}\`, encoded as ${dataset.questionBank.mcq.storage.payloadEncoding}.`
);
push('');
push(
	`Required fields: ${dataset.questionBank.mcq.schema.requiredFields.map((field) => `\`${field}\``).join(', ')}.`
);
push(
	`Optional fields: ${dataset.questionBank.mcq.schema.optionalFields.map((field) => `\`${field}\``).join(', ')}.`
);
push(
	`Metadata fields: ${dataset.questionBank.mcq.schema.metadataFields.map((field) => `\`${field}\``).join(', ')}.`
);
push(
	`Correct-answer values: ${dataset.questionBank.mcq.schema.correctAnswerValues.join(', ')}. Additional properties allowed: ${dataset.questionBank.mcq.schema.additionalProperties}.`
);
push('');
push('Generation rules:');
for (const rule of dataset.questionBank.mcq.generationRules) push(`- ${inline(rule)}`);
push('');
push('Pool controls:');
for (const [key, value] of Object.entries(dataset.questionBank.mcq.poolRules))
	push(`- \`${key}\`: ${inline(value)}`);
push('');

push('## App FRQ contract and support');
push('');
push(
	`Storage: **${dataset.questionBank.frq.storage.database}**, table \`${dataset.questionBank.frq.storage.table}\`, payload field \`${dataset.questionBank.frq.storage.payloadField}\`, encoded as ${dataset.questionBank.frq.storage.payloadEncoding}.`
);
push('');
push(
	`Schema version: ${dataset.questionBank.frq.schema.schemaVersion}. Required fields: ${dataset.questionBank.frq.schema.requiredFields.map((field) => `\`${field}\``).join(', ')}.`
);
push(
	`Student-visible fields: ${dataset.questionBank.frq.schema.studentVisibleFields.map((field) => `\`${field}\``).join(', ')}.`
);
push(
	`Private grading fields: ${dataset.questionBank.frq.schema.privateGradingFields.map((field) => `\`${field}\``).join(', ')}.`
);
push('');
push('Validation rules:');
for (const rule of dataset.questionBank.frq.schema.validationRules) push(`- ${inline(rule)}`);
push('');
push(
	`App FRQ profiles are currently enabled for: ${dataset.questionBank.frq.appSupportedCourses.join(', ')}.`
);
push('');
for (const course of dataset.courses.filter((candidate) => candidate.app.practice.frq.enabled)) {
	const frq = course.generation.frq as {
		formatId?: string;
		profileVersion?: string;
		rubricVersion?: string;
		allowedResponseTypes?: string[];
		generationConstraints?: Record<string, unknown>;
		generationGuidance?: string;
		gradingGuidance?: string;
	};
	push(`### ${course.name} app FRQ profile`);
	push('');
	push(`- Format: \`${inline(frq.formatId)}\``);
	push(`- Profile version: \`${inline(frq.profileVersion)}\``);
	push(`- Rubric version: \`${inline(frq.rubricVersion)}\``);
	push(`- Supported response types: ${(frq.allowedResponseTypes ?? []).map(inline).join(', ')}`);
	push(
		`- Generation constraints: ${Object.entries(frq.generationConstraints ?? {})
			.map(([key, value]) => `${key}=${inline(value)}`)
			.join('; ')}`
	);
	push(`- Generation guidance: ${inline(frq.generationGuidance)}`);
	push(`- Grading guidance: ${inline(frq.gradingGuidance)}`);
	push('');
}
const unsupportedFrq = dataset.courses
	.filter((course) => !course.app.practice.frq.enabled)
	.map((course) => course.name);
push(
	`The other ${unsupportedFrq.length} courses have official written-response or performance components where shown in their exam records, but their custom Free AP Practice FRQ generator is explicitly disabled: ${unsupportedFrq.join(', ')}.`
);
push('');

push('## Alignment findings and limitations');
push('');
for (const course of dataset.courses.filter(
	(candidate) => candidate.alignment.status !== 'aligned'
)) {
	push(`### ${course.name}`);
	push('');
	push(
		`Status: **${inline(course.alignment.status)}**. ${course.alignment.notes.map(inline).join(' ')}`
	);
	for (const difference of course.alignment.differences) {
		push(`- ${inline(difference.type)} in \`${inline(difference.file)}\`.`);
		push(`  - App base labels: ${difference.appCatalogLabels.map(inline).join('; ')}`);
		push(
			`  - Knowledge-catalog labels: ${difference.knowledgeCatalogLabels.map(inline).join('; ')}`
		);
	}
	push('');
}
push(
	'- The app currently has 179 base-catalog units. The knowledge catalog has explicit overrides for AP Physics 2, AP Statistics, and AP Spanish Language; the JSON preserves both values instead of silently choosing one.'
);
push(
	'- AP Statistics and AP Spanish Language have 2026–27 revised official frameworks/exams. AP Physics 2’s current official sequence also differs from the app base catalog in later unit labels.'
);
push(
	'- The JSON is a source-aware static snapshot. It does not replace live College Board pages, future CED revisions, the Neon question tables, or user attempt/history data.'
);
push(
	'- AP African American Studies was researched as an official AP course in the source work but is not included because it is not in the current Free AP Practice app catalog.'
);
push('');

push('## Source registry');
push('');
push(
	'Every source ID referenced by the JSON resolves to an entry below. Official College Board sources are marked by their publisher; app sources point to repository files and are not treated as official AP authority.'
);
push('');
push('| ID | Publisher | Type | Supports | Link |');
push('| --- | --- | --- | --- | --- |');
for (const source of dataset.sources) {
	const link = source.url.startsWith('http')
		? `[${inline(source.title)}](${source.url})`
		: `\`${inline(source.url)}\``;
	push(
		`| \`${source.id}\` | ${inline(source.publisher)} | ${inline(source.sourceType)} | ${source.supports.map(inline).join('; ')} | ${link} |`
	);
}
push('');
push('## Validation snapshot');
push('');
push(
	`The artifact was generated from the current repository sources and validated with \`scripts/validate-ap-classes-data.ts\`. Expected invariants: **${dataset.scope.appCourseCount} courses**, **${dataset.scope.appUnitCount} units**, **${dataset.scope.practicePageCount} practice pages**, unique course/unit IDs, exact current app labels/order, resolvable practice pages, resolvable source references, synchronized FRQ profiles, and no embedded question instances.`
);
push('');
push('End of report.');

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${lines.join('\n')}\n`);
console.log(`Wrote ${OUTPUT}`);
console.log(
	`Lines: ${lines.length}; courses: ${dataset.courses.length}; units: ${dataset.scope.appUnitCount}`
);
