import { getCourseNames } from '#lib/catalog/courses.js';
import { AP_DATA, type UnifiedCourse } from '#lib/catalog/dataset.js';

type CatalogCourseSummary = {
	course: string;
};

export type CatalogSource = {
	title: string;
	url: string;
};

export type CatalogFacts =
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
			course: CatalogCourseSummary;
			units: Array<{ name: string }>;
			sources: CatalogSource[];
	  }
	| {
			kind: 'unit';
			catalogVersion: string;
			reviewedAt: string;
			freshnessNote: string;
			course: CatalogCourseSummary;
			unit: { name: string; coverage: 'official_unit_title_only' };
			sources: CatalogSource[];
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

export const CATALOG_VERSION = AP_DATA.datasetVersion;
const CATALOG_REVIEWED_AT = AP_DATA.asOf;
const CATALOG_FRESHNESS_NOTE =
	`Course and unit labels are an MVP ${CATALOG_VERSION} catalog reviewed ${CATALOG_REVIEWED_AT}. ` +
	'Only unit titles and official links are source-backed. Check the linked official pages for live exam dates, policies, detailed topics, and later revisions.';

function unitsFor(course: UnifiedCourse): string[] {
	return course.units.map((unit) => unit.label);
}

function courseSummary(course: string): CatalogCourseSummary {
	return { course };
}

function sourcesFor(course: string): CatalogSource[] {
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
		catalogVersion: CATALOG_VERSION,
		reviewedAt: CATALOG_REVIEWED_AT,
		freshnessNote: CATALOG_FRESHNESS_NOTE
	};
}

/** Retrieve bounded AP catalog facts and links to the current official sources. */
export function getCatalogFacts(input: { course?: string; unit?: string }): CatalogFacts {
	if (!input.course?.trim()) {
		if (input.unit?.trim()) {
			return {
				kind: 'not_found',
				message: 'Choose an AP course before requesting unit curriculum knowledge.',
				availableCourses: getCourseNames()
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
			availableCourses: getCourseNames()
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
