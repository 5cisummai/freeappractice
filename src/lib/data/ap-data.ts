import dataset from './ap-classes-data-08212026.json';

export const AP_DATA = dataset;
export type ApData = typeof AP_DATA;
export type UnifiedCourse = ApData['courses'][number];
export type UnifiedUnit = UnifiedCourse['units'][number];

export type ApCourse = {
	name: string;
	semester1: string[];
	semester2: string[];
};

/** The app-facing course/unit selector catalog. */
export const APP_COURSES: ApCourse[] = AP_DATA.courses.map((course) => ({
	name: course.name,
	semester1: [...course.app.catalog.semester1UnitLabels],
	semester2: [...course.app.catalog.semester2UnitLabels]
}));

export type UnitDescriptionsFile = {
	note: string;
	courses: Array<{
		apClass: string;
		units: Array<{
			unit: string;
			description?: string;
			topics?: string[];
			keywords?: string[];
		}>;
	}>;
};

function textList(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
	return typeof value === 'string' && value.trim() ? [value] : [];
}

/** MCQ generation controls projected from app-authored fields only. */
export const UNIT_DESCRIPTIONS: UnitDescriptionsFile = {
	note: 'App-authored generation controls are stored in ap-classes-data-08212026.json.',
	courses: AP_DATA.courses.map((course) => ({
		apClass: course.name,
		units: course.units.map((unit) => ({
			unit: unit.label,
			description: 'Use the app-authored generation controls for this unit.',
			topics: textList(unit.generation.mcq.constraints),
			keywords: textList(unit.generation.mcq.keywords)
		}))
	}))
};

/** SEO and article records projected from class and unit page content. */
export const PRACTICE_PAGES = AP_DATA.courses
	.flatMap((course) => [
		course.app.practice.classPage,
		...course.units.map((unit) => unit.app.pageContent)
	])
	.filter((page): page is NonNullable<typeof page> => Boolean(page));
