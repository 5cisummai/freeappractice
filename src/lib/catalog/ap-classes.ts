import apClassesData from '$lib/data/ap-classes.json';

export type ApCourse = {
	name: string;
	semester1: string[];
	semester2: string[];
};

const courses = (apClassesData.courses ?? []) as ApCourse[];

/** All AP courses from catalog data, with "AP Lunch" entries last. */
export function getCourses(): ApCourse[] {
	const lunch = courses.filter((c) => c.name.toLowerCase().includes('ap lunch'));
	const rest = courses.filter((c) => !c.name.toLowerCase().includes('ap lunch'));
	return [...rest, ...lunch];
}

export function getUnitsForClass(className: string): string[] {
	const course = courses.find((c) => c.name === className);
	if (!course) return [];
	return [...course.semester1, ...course.semester2];
}

export function getAllowedClassNames(): Set<string> {
	return new Set(courses.map((c) => c.name));
}

/** When "All Units" is selected (unit === ''), pick a random real unit for the class. */
export function resolveEffectiveUnit(cls: string, unit: string): string {
	if (unit.trim()) return unit.trim();
	const allUnits = getUnitsForClass(cls);
	if (!allUnits.length) return '';
	return allUnits[Math.floor(Math.random() * allUnits.length)];
}
