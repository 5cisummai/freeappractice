import { createHash } from 'node:crypto';
import { AP_DATA } from '#lib/catalog/dataset.js';
import { getCourses, isMcqPracticeCourse } from '#lib/catalog/courses.js';

export type MobileCatalogUnit = {
	id: string;
	number: number;
	label: string;
	mcqEnabled: boolean;
};

export type MobileCatalogCourse = {
	id: string;
	name: string;
	displayName: string;
	mcqEnabled: boolean;
	units: MobileCatalogUnit[];
};

export type MobileCatalogSnapshot = {
	/** Dataset identifier from the authoritative catalog file. */
	datasetId: string;
	/** Human-readable dataset version from the catalog file. */
	datasetVersion: string;
	/** Content hash of this API payload; use as an ETag / cache key. */
	version: string;
	generatedAt: string;
	courses: MobileCatalogCourse[];
};

function buildCourses(): MobileCatalogCourse[] {
	const byName = new Map(AP_DATA.courses.map((course) => [course.name, course] as const));

	return getCourses().map((course) => {
		const unified = byName.get(course.name);
		const units: MobileCatalogUnit[] = (unified?.units ?? []).map((unit) => ({
			id: unit.id,
			number: unit.number,
			label: unit.label,
			mcqEnabled: unit.generation?.mcq?.enabled === true && isMcqPracticeCourse(course.name)
		}));

		return {
			id: unified?.id ?? course.name,
			name: course.name,
			displayName: course.name,
			mcqEnabled: isMcqPracticeCourse(course.name),
			units
		};
	});
}

/** Read-only mobile catalog snapshot. Server catalog data is authoritative. */
export function getMobileCatalogSnapshot(): MobileCatalogSnapshot {
	const courses = buildCourses();
	const body = JSON.stringify({
		datasetId: AP_DATA.datasetId,
		datasetVersion: AP_DATA.datasetVersion,
		courses
	});
	const version = createHash('sha256').update(body).digest('hex').slice(0, 32);

	return {
		datasetId: AP_DATA.datasetId,
		datasetVersion: AP_DATA.datasetVersion,
		version,
		generatedAt: AP_DATA.generatedAt,
		courses
	};
}
