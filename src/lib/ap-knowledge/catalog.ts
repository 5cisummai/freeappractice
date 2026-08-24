import { AP_DATA, type UnifiedCourse } from '$lib/data/ap-data';

type ApKnowledgeCourseSummary = {
	apClass: string;
};

export type ApKnowledgeSource = {
	title: string;
	url: string;
};

export type ApKnowledgeResult =
	| {
			kind: 'catalog';
			catalogVersion: string;
			reviewedAt: string;
			freshnessNote: string;
			courses: Array<{ apClass: string; units: string[] }>;
	  }
	| {
			kind: 'course';
			catalogVersion: string;
			reviewedAt: string;
			freshnessNote: string;
			course: ApKnowledgeCourseSummary;
			units: Array<{ name: string }>;
			sources: ApKnowledgeSource[];
	  }
	| {
			kind: 'unit';
			catalogVersion: string;
			reviewedAt: string;
			freshnessNote: string;
			course: ApKnowledgeCourseSummary;
			unit: { name: string; coverage: 'official_unit_title_only' };
			sources: ApKnowledgeSource[];
	  }
	| {
			kind: 'not_found';
			message: string;
			availableCourses?: string[];
			availableUnits?: string[];
	  };

const supportedCourses = AP_DATA.courses;
const courseByName = new Map(supportedCourses.map((course) => [normalize(course.name), course]));
const sourceById = new Map(AP_DATA.sources.map((source) => [source.id, source] as const));

export const AP_KNOWLEDGE_CATALOG_VERSION = AP_DATA.datasetVersion;
export const AP_KNOWLEDGE_REVIEWED_AT = AP_DATA.asOf;
export const AP_KNOWLEDGE_FRESHNESS_NOTE =
	`Course and unit labels are an MVP ${AP_KNOWLEDGE_CATALOG_VERSION} catalog reviewed ${AP_KNOWLEDGE_REVIEWED_AT}. ` +
	'Only unit titles and official links are source-backed. Check the linked official pages for live exam dates, policies, detailed topics, and later revisions.';

function normalize(value: string): string {
	return value
		.normalize('NFKD')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function unitsFor(course: UnifiedCourse): string[] {
	return course.official.framework.unitLabels
		? [...course.official.framework.unitLabels]
		: course.units.map((unit) => unit.label);
}

function unitTitle(value: string): string {
	return value.replace(/^\s*(?:unit|big idea)\s*\d+\s*:\s*/i, '').trim();
}

function unitNumber(value: string): number | null {
	const match = value.match(/\b(?:unit|big idea)\s*(\d+)\b/i);
	return match ? Number(match[1]) : null;
}

function findUnit(course: UnifiedCourse, requested: string) {
	const query = normalize(requested);
	const queryNumber = unitNumber(requested);
	const requestedTitle = requested.match(/:\s*(.+)$/)?.[1]?.trim();
	const titleQuery = normalize(requestedTitle ?? requested);
	const candidates = unitsFor(course).map((name) => ({
		name,
		number: unitNumber(name),
		title: normalize(unitTitle(name))
	}));
	const exact = candidates.find(
		(candidate) => normalize(candidate.name) === query || candidate.title === query
	);
	if (exact) return exact.name;
	if (queryNumber !== null) {
		const numbered = candidates.find((candidate) => candidate.number === queryNumber);
		if (numbered && !requestedTitle) return numbered.name;
	}
	if (titleQuery.length >= 4) {
		const partial = candidates.find(
			(candidate) =>
				(queryNumber === null || candidate.number === queryNumber) &&
				(candidate.title.includes(titleQuery) || titleQuery.includes(candidate.title))
		);
		if (partial) return partial.name;
	}
	return null;
}

function courseSummary(apClass: string): ApKnowledgeCourseSummary {
	return { apClass };
}

function sourcesFor(apClass: string): ApKnowledgeSource[] {
	const course = supportedCourses.find((candidate) => candidate.name === apClass);
	if (!course) return [];

	const sourceIds = [...course.official.sourceIds, ...course.official.exam.sourceIds].filter(
		(id, index, ids) =>
			(id.startsWith('cb-course-') || id.startsWith('cb-exam-')) && ids.indexOf(id) === index
	);
	return sourceIds.flatMap((sourceId) => {
		const source = sourceById.get(sourceId);
		return source ? [{ title: source.title, url: source.url }] : [];
	});
}

function metadata() {
	return {
		catalogVersion: AP_KNOWLEDGE_CATALOG_VERSION,
		reviewedAt: AP_KNOWLEDGE_REVIEWED_AT,
		freshnessNote: AP_KNOWLEDGE_FRESHNESS_NOTE
	};
}

export function listApCurriculumCourseNames(): string[] {
	return supportedCourses.map((course) => course.name);
}

/** Retrieve bounded AP catalog facts and links to the current official sources. */
export function getApCurriculumKnowledge(input: {
	apClass?: string;
	unit?: string;
}): ApKnowledgeResult {
	if (!input.apClass?.trim()) {
		if (input.unit?.trim()) {
			return {
				kind: 'not_found',
				message: 'Choose an AP class before requesting unit curriculum knowledge.',
				availableCourses: listApCurriculumCourseNames()
			};
		}
		return {
			kind: 'catalog',
			...metadata(),
			courses: supportedCourses.map((course) => ({
				apClass: course.name,
				units: unitsFor(course)
			}))
		};
	}

	const course = courseByName.get(normalize(input.apClass));
	if (!course) {
		return {
			kind: 'not_found',
			message: `No curated AP curriculum knowledge is available for ${input.apClass}.`,
			availableCourses: listApCurriculumCourseNames()
		};
	}

	const sources = sourcesFor(course.name);
	if (!input.unit?.trim()) {
		return {
			kind: 'course',
			...metadata(),
			course: courseSummary(course.name),
			units: unitsFor(course).map((name) => ({ name })),
			sources
		};
	}

	const unit = findUnit(course, input.unit);
	if (!unit) {
		return {
			kind: 'not_found',
			message: `No catalog unit matched ${input.unit} in ${course.name}.`,
			availableUnits: unitsFor(course)
		};
	}

	return {
		kind: 'unit',
		...metadata(),
		course: courseSummary(course.name),
		unit: { name: unit, coverage: 'official_unit_title_only' },
		sources
	};
}
