import { AP_DATA, type UnifiedCourse } from '$lib/data/ap-data';

type ApKnowledgeCourseSummary = {
	course: string;
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
			courses: Array<{ course: string; units: string[] }>;
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
const courseByName = new Map(supportedCourses.map((course) => [course.name, course] as const));
const sourceById = new Map(AP_DATA.sources.map((source) => [source.id, source] as const));

export const AP_KNOWLEDGE_CATALOG_VERSION = AP_DATA.datasetVersion;
const AP_KNOWLEDGE_REVIEWED_AT = AP_DATA.asOf;
const AP_KNOWLEDGE_FRESHNESS_NOTE =
	`Course and unit labels are an MVP ${AP_KNOWLEDGE_CATALOG_VERSION} catalog reviewed ${AP_KNOWLEDGE_REVIEWED_AT}. ` +
	'Only unit titles and official links are source-backed. Check the linked official pages for live exam dates, policies, detailed topics, and later revisions.';

function unitsFor(course: UnifiedCourse): string[] {
	return course.units.map((unit) => unit.label);
}

function courseSummary(course: string): ApKnowledgeCourseSummary {
	return { course };
}

function sourcesFor(course: string): ApKnowledgeSource[] {
	const match = supportedCourses.find((candidate) => candidate.name === course);
	if (!match) return [];

	const sourceIds = [...match.official.sourceIds, ...match.official.exam.sourceIds].filter(
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
	course?: string;
	unit?: string;
}): ApKnowledgeResult {
	if (!input.course?.trim()) {
		if (input.unit?.trim()) {
			return {
				kind: 'not_found',
				message: 'Choose an AP course before requesting unit curriculum knowledge.',
				availableCourses: listApCurriculumCourseNames()
			};
		}
		return {
			kind: 'catalog',
			...metadata(),
			courses: supportedCourses.map((course) => ({
				course: course.name,
				units: unitsFor(course)
			}))
		};
	}

	const course = courseByName.get(input.course);
	if (!course) {
		return {
			kind: 'not_found',
			message: `No curated AP curriculum knowledge is available for ${input.course}.`,
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

	const unit = unitsFor(course).find((name) => name === input.unit);
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
