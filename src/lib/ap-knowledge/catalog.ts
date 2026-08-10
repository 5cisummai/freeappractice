import apClassesData from '$lib/data/ap-classes.json';

type ApClassesData = {
	courses: Array<{ name: string; semester1: string[]; semester2: string[] }>;
};

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

const classData = apClassesData as ApClassesData;
const supportedCourses = classData.courses;
const courseByName = new Map(supportedCourses.map((course) => [normalize(course.name), course]));

const CURRENT_UNIT_OVERRIDES: Record<string, string[]> = {
	'AP Physics 2': [
		'Unit 9: Thermodynamics',
		'Unit 10: Electric Force, Field, and Potential',
		'Unit 11: Electric Circuits',
		'Unit 12: Magnetism and Electromagnetism',
		'Unit 13: Geometric Optics',
		'Unit 14: Waves, Sound, and Physical Optics',
		'Unit 15: Modern Physics'
	],
	'AP Statistics': [
		'Unit 1: Exploring One-Variable Data and Collecting Data',
		'Unit 2: Probability, Random Variables, and Probability Distributions',
		'Unit 3: Inference for Categorical Data: Proportions',
		'Unit 4: Inference for Quantitative Data: Means',
		'Unit 5: Regression Analysis'
	],
	'AP Spanish Language': [
		'Unit 1: Families and Communities',
		'Unit 2: Language and Culture',
		'Unit 3: Art and Creativity',
		'Unit 4: Science and Technology',
		'Unit 5: Contemporary Life',
		'Unit 6: Global Contexts'
	]
};

const AP_CENTRAL_SLUGS: Record<string, string> = {
	'AP Biology': 'ap-biology',
	'AP Chemistry': 'ap-chemistry',
	'AP Physics 1': 'ap-physics-1',
	'AP Physics 2': 'ap-physics-2',
	'AP Physics C: Mechanics': 'ap-physics-c-mechanics',
	'AP Physics C: E&M': 'ap-physics-c-electricity-and-magnetism',
	'AP Environmental Science': 'ap-environmental-science',
	'AP Calculus AB': 'ap-calculus-ab',
	'AP Calculus BC': 'ap-calculus-bc',
	'AP Statistics': 'ap-statistics',
	'AP Precalculus': 'ap-precalculus',
	'AP Computer Science A': 'ap-computer-science-a',
	'AP Computer Science Principles': 'ap-computer-science-principles',
	'AP English Language': 'ap-english-language-and-composition',
	'AP English Literature': 'ap-english-literature-and-composition',
	'AP US History': 'ap-united-states-history',
	'AP World History': 'ap-world-history',
	'AP European History': 'ap-european-history',
	'AP US Government': 'ap-united-states-government-and-politics',
	'AP Comparative Government': 'ap-comparative-government-and-politics',
	'AP Psychology': 'ap-psychology',
	'AP Human Geography': 'ap-human-geography',
	'AP Macroeconomics': 'ap-macroeconomics',
	'AP Microeconomics': 'ap-microeconomics',
	'AP Spanish Language': 'ap-spanish-language-and-culture'
};

export const AP_KNOWLEDGE_CATALOG_VERSION = '2026-27';
export const AP_KNOWLEDGE_REVIEWED_AT = '2026-08-09';
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

function unitsFor(course: { name: string; semester1: string[]; semester2: string[] }): string[] {
	return CURRENT_UNIT_OVERRIDES[course.name] ?? [...course.semester1, ...course.semester2];
}

function unitTitle(value: string): string {
	return value.replace(/^\s*(?:unit|big idea)\s*\d+\s*:\s*/i, '').trim();
}

function unitNumber(value: string): number | null {
	const match = value.match(/\b(?:unit|big idea)\s*(\d+)\b/i);
	return match ? Number(match[1]) : null;
}

function findUnit(
	course: { name: string; semester1: string[]; semester2: string[] },
	requested: string
) {
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
	const slug = AP_CENTRAL_SLUGS[apClass];
	if (!slug) return [];
	const courseUrl = `https://apcentral.collegeboard.org/courses/${slug}`;
	return [
		{ title: `${apClass} — official course page`, url: courseUrl },
		{ title: `${apClass} — current exam page`, url: `${courseUrl}/exam` }
	];
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
