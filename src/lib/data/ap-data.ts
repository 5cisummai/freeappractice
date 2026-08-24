import dataset from './ap-classes-data-08212026.json';

export const AP_DATA = dataset;
export type ApData = typeof AP_DATA;
export type UnifiedCourse = ApData['courses'][number];
export type UnifiedUnit = UnifiedCourse['units'][number];
export type UnifiedPage = ApData['pages'][number];

export type ApCourse = {
	name: string;
	semester1: string[];
	semester2: string[];
};

function appUnitLabels(course: UnifiedCourse, semester: 1 | 2): string[] {
	return course.units.filter((unit) => unit.app.semester === semester).map((unit) => unit.label);
}

/** The app-facing course/unit selector catalog, reconstructed from normalized unit records. */
export const APP_COURSES: ApCourse[] = AP_DATA.courses.map((course) => ({
	name: course.name,
	semester1: appUnitLabels(course, 1),
	semester2: appUnitLabels(course, 2)
}));

/** Pool controls projected from the unified question-bank configuration. */
export const QUESTION_POOL_TARGETS = AP_DATA.questionBank.mcq.poolRules;

const courseById = new Map(AP_DATA.courses.map((course) => [course.id, course] as const));
const unitById = new Map(
	AP_DATA.courses.flatMap((course) => course.units.map((unit) => [unit.id, unit] as const))
);

/** SEO and article records projected from the normalized page index. */
export const PRACTICE_PAGES = AP_DATA.pages.map((page) => {
	const course = courseById.get(page.courseId);
	if (!course) throw new Error(`Unknown practice page course: ${page.courseId}`);

	const unit = page.unitId ? unitById.get(page.unitId) : undefined;
	if (page.unitId && !unit) throw new Error(`Unknown practice page unit: ${page.unitId}`);

	return {
		slug: page.id,
		type: page.type,
		className: course.name,
		...(unit ? { unitName: unit.label } : {}),
		seo: page.seo,
		article: page.article,
		links: page.links
	};
});
