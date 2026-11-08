import { AP_DATA, type UnifiedCourse } from '#lib/catalog/courses.js';

export type ExamBlueprintPartPacing = 'enforced' | 'recommended';

export type ExamBlueprintPart = {
	id: string;
	questionCount?: number;
	durationMinutes?: number;
	weightPercent?: number;
	calculatorPolicy?: string;
	notes?: string[];
};

export type ExamBlueprintSectionKind = 'mcq' | 'frq';

export type ExamBlueprintSection = {
	id: string;
	label: string;
	kind: ExamBlueprintSectionKind;
	questionCount: number;
	timeLimitMs: number;
	weightPercent: number;
	questionTypes: string[];
	notes?: string[];
	parts?: ExamBlueprintPart[];
	partPacing?: ExamBlueprintPartPacing;
};

export type ExamBlueprint = {
	courseId: string;
	courseName: string;
	officialName: string;
	sourceIds: string[];
	totalDurationMinutes: number;
	sections: ExamBlueprintSection[];
	taskQuotas?: string[];
};

export type ExamBlueprintResult =
	| { ok: true; blueprint: ExamBlueprint }
	| { ok: false; reason: string };

type CatalogExamSection = UnifiedCourse['official']['exam']['sections'][number];
type CatalogExamPart = NonNullable<CatalogExamSection['parts']>[number];

const UNSUPPORTED_SECTION_IDS = new Set(['create-performance-task']);

const UNSUPPORTED_QUESTION_TYPES = new Set([
	'multiple-select-two-answers',
	'project-presentation',
	'project-question-and-answer',
	'listening'
]);

const MS_PER_MINUTE = 60_000;

function fail(reason: string): ExamBlueprintResult {
	return { ok: false, reason };
}

function sectionKind(sectionId: string): ExamBlueprintSectionKind | null {
	switch (sectionId) {
		case 'multiple-choice':
			return 'mcq';
		case 'free-response':
		case 'short-answer':
		case 'dbq-and-leq':
		case 'written-response':
			return 'frq';
		default:
			return null;
	}
}

function isTaskControlled(course: UnifiedCourse): boolean {
	const frq = course.generation.frq;
	return (
		typeof frq === 'object' &&
		frq !== null &&
		'control' in frq &&
		frq.control === 'task'
	);
}

function collectUnsupportedQuestionTypes(sections: CatalogExamSection[]): string | null {
	for (const section of sections) {
		const types = 'questionTypes' in section ? section.questionTypes : [];
		for (const type of types) {
			if (UNSUPPORTED_QUESTION_TYPES.has(type)) {
				return type;
			}
		}
	}
	return null;
}

function mapPart(part: CatalogExamPart): ExamBlueprintPart {
	const mapped: ExamBlueprintPart = { id: part.id };
	if ('questionCount' in part && typeof part.questionCount === 'number') {
		mapped.questionCount = part.questionCount;
	}
	if ('durationMinutes' in part && typeof part.durationMinutes === 'number') {
		mapped.durationMinutes = part.durationMinutes;
	}
	if ('weightPercent' in part && typeof part.weightPercent === 'number') {
		mapped.weightPercent = part.weightPercent;
	}
	if ('calculatorPolicy' in part && typeof part.calculatorPolicy === 'string') {
		mapped.calculatorPolicy = part.calculatorPolicy;
	}
	if ('notes' in part && Array.isArray(part.notes)) {
		mapped.notes = part.notes;
	}
	return mapped;
}

function resolvePartPacing(
	section: CatalogExamSection,
	parts: CatalogExamPart[]
): { pacing: ExamBlueprintPartPacing } | { error: string } {
	const hasCalculatorPolicy = parts.some(
		(part) => 'calculatorPolicy' in part && typeof part.calculatorPolicy === 'string'
	);
	if (hasCalculatorPolicy) {
		const durations = parts.map((part) =>
			'durationMinutes' in part && typeof part.durationMinutes === 'number'
				? part.durationMinutes
				: null
		);
		if (durations.some((value) => value === null)) {
			return { error: `Section "${section.id}" has calculator parts without durations.` };
		}
		const total = durations.reduce((sum, value) => sum + value!, 0);
		if (
			'durationMinutes' in section &&
			typeof section.durationMinutes === 'number' &&
			total !== section.durationMinutes
		) {
			return {
				error: `Section "${section.id}" part durations (${total} min) do not match the section total (${section.durationMinutes} min).`
			};
		}
		return { pacing: 'enforced' };
	}
	return { pacing: 'recommended' };
}

function requiredNumber(
	value: unknown,
	label: string,
	sectionId: string
): { value: number } | { error: string } {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return { error: `Section "${sectionId}" is missing ${label}.` };
	}
	return { value };
}

function parseSection(
	section: CatalogExamSection
): { section: ExamBlueprintSection } | { error: string } {
	if (UNSUPPORTED_SECTION_IDS.has(section.id)) {
		return { error: `Section "${section.id}" is not supported for full-length exams.` };
	}
	const kind = sectionKind(section.id);
	if (!kind) {
		return { error: `Section "${section.id}" has no supported exam kind.` };
	}
	const questionCount = requiredNumber(
		'questionCount' in section ? section.questionCount : undefined,
		'questionCount',
		section.id
	);
	if ('error' in questionCount) return questionCount;
	const durationMinutes = requiredNumber(
		'durationMinutes' in section ? section.durationMinutes : undefined,
		'durationMinutes',
		section.id
	);
	if ('error' in durationMinutes) return durationMinutes;
	const weightPercent = requiredNumber(
		'weightPercent' in section ? section.weightPercent : undefined,
		'weightPercent',
		section.id
	);
	if ('error' in weightPercent) return weightPercent;

	const questionTypes =
		'questionTypes' in section && Array.isArray(section.questionTypes) ? [...section.questionTypes] : [];
	const notes = 'notes' in section && Array.isArray(section.notes) ? [...section.notes] : undefined;

	let parts: ExamBlueprintPart[] | undefined;
	let partPacing: ExamBlueprintPartPacing | undefined;
	if ('parts' in section && Array.isArray(section.parts) && section.parts.length > 0) {
		const catalogParts = section.parts;
		const pacingResult = resolvePartPacing(section, catalogParts);
		if ('error' in pacingResult) return pacingResult;
		partPacing = pacingResult.pacing;
		parts = catalogParts.map(mapPart);
	}

	return {
		section: {
			id: section.id,
			label: section.label,
			kind,
			questionCount: questionCount.value,
			timeLimitMs: durationMinutes.value * MS_PER_MINUTE,
			weightPercent: weightPercent.value,
			questionTypes,
			...(notes?.length ? { notes } : {}),
			...(parts ? { parts, partPacing } : {})
		}
	};
}

/** Load a course's official exam structure from catalog data for assembly and scoring. */
export function loadExamBlueprint(courseName: string): ExamBlueprintResult {
	const course = AP_DATA.courses.find((item) => item.name === courseName);
	if (!course) {
		return fail(`Unknown course "${courseName}".`);
	}

	const exam = course.official.exam;
	const unsupportedType = collectUnsupportedQuestionTypes(exam.sections);
	if (unsupportedType) {
		return fail(`Question type "${unsupportedType}" is not supported for full-length exams.`);
	}

	const sections: ExamBlueprintSection[] = [];
	for (const catalogSection of exam.sections) {
		const parsed = parseSection(catalogSection);
		if ('error' in parsed) {
			return fail(parsed.error);
		}
		sections.push(parsed.section);
	}

	let taskQuotas: string[] | undefined;
	if (isTaskControlled(course)) {
		const quotas: string[] = [];
		for (const catalogSection of exam.sections) {
			if (sectionKind(catalogSection.id) !== 'frq') continue;
			if (!('questionTypes' in catalogSection)) continue;
			for (const type of catalogSection.questionTypes) {
				if (!quotas.includes(type)) quotas.push(type);
			}
		}
		if (quotas.length > 0) taskQuotas = quotas;
	}

	return {
		ok: true,
		blueprint: {
			courseId: course.id,
			courseName: course.name,
			officialName: exam.officialName,
			sourceIds: [...exam.sourceIds],
			totalDurationMinutes: exam.totalDurationMinutes,
			sections,
			...(taskQuotas ? { taskQuotas } : {})
		}
	};
}
