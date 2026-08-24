import dataset from '../src/lib/data/ap-classes-data-08212026.json';

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

const sourceIds = new Set(dataset.sources.map((source) => source.id));
const courseIds = new Set<string>();
const unitIds = new Set<string>();
const pageIds = new Set<string>();
const courseById = new Map(dataset.courses.map((course) => [course.id, course] as const));
const unitById = new Map(
	dataset.courses.flatMap((course) => course.units.map((unit) => [unit.id, unit] as const))
);
const pageById = new Map(dataset.pages.map((page) => [page.id, page] as const));

if (dataset.scope.appCourseCount !== dataset.courses.length)
	fail(`Expected ${dataset.scope.appCourseCount} courses, found ${dataset.courses.length}.`);
if (
	dataset.scope.appUnitCount !==
	dataset.courses.reduce((sum, course) => sum + course.units.length, 0)
)
	fail(
		`Expected ${dataset.scope.appUnitCount} units, found ${dataset.courses.reduce((sum, course) => sum + course.units.length, 0)}.`
	);
if (dataset.scope.practicePageCount !== dataset.pages.length)
	fail(`Expected ${dataset.scope.practicePageCount} pages, found ${dataset.pages.length}.`);
if (pageById.size !== dataset.pages.length) fail('Practice page IDs must be unique.');

function collectSourceReferences(value: unknown, key = ''): string[] {
	if (Array.isArray(value)) {
		if (
			(key === 'sourceIds' || key === 'sources') &&
			value.every((item) => typeof item === 'string')
		) {
			return value as string[];
		}
		return value.flatMap((item) => collectSourceReferences(item, key));
	}
	if (value && typeof value === 'object') {
		return Object.entries(value).flatMap(([childKey, childValue]) =>
			collectSourceReferences(childValue, childKey)
		);
	}
	return [];
}

for (const page of dataset.pages) {
	if (pageIds.has(page.id)) fail(`Duplicate practice page ID: ${page.id}.`);
	pageIds.add(page.id);

	const course = courseById.get(page.courseId);
	if (!course) {
		fail(`Missing course for practice page ${page.id}.`);
		continue;
	}
	if (page.type === 'class' && page.unitId)
		fail(`Class page ${page.id} should not reference a unit.`);
	if (page.type === 'unit' && !page.unitId)
		fail(`Unit page ${page.id} is missing a unit reference.`);
	if (page.unitId && !unitById.has(page.unitId))
		fail(`Missing unit for practice page ${page.id}: ${page.unitId}.`);
	if (page.unitId && unitById.get(page.unitId)?.app.practicePageId !== page.id)
		fail(`Practice page ${page.id} does not match its unit reference.`);
	if (page.type === 'class' && course.app.practice.classPageId !== page.id)
		fail(`Class page ${page.id} does not match ${course.name}.`);
}

for (const course of dataset.courses) {
	if (courseIds.has(course.id)) fail(`Duplicate course ID: ${course.id}.`);
	courseIds.add(course.id);

	const sourceReferences = collectSourceReferences(course);
	for (const sourceId of sourceReferences) {
		if (!sourceIds.has(sourceId))
			fail(`Missing source registry entry: ${sourceId} (${course.name}).`);
	}

	const appLabels = course.units.map((unit) => unit.label);
	const semesterLabels = [
		...course.units.filter((unit) => unit.app.semester === 1).map((unit) => unit.label),
		...course.units.filter((unit) => unit.app.semester === 2).map((unit) => unit.label)
	];
	if (semesterLabels.length !== appLabels.length)
		fail(`Every unit must belong to semester 1 or 2 for ${course.name}.`);

	const officialLabels = course.official.framework.unitLabels ?? appLabels;
	if (
		course.official.framework.unitLabelsSource === 'appUnits' &&
		course.official.framework.unitLabels
	)
		fail(`App-derived framework labels should not be duplicated for ${course.name}.`);
	if (course.official.framework.unitCount !== officialLabels.length)
		fail(`Official framework unit count differs from labels for ${course.name}.`);

	for (const unit of course.units) {
		if (unitIds.has(unit.id)) fail(`Duplicate unit ID: ${unit.id}.`);
		unitIds.add(unit.id);
		if (!unit.app.practicePageId) fail(`Missing practice page ID for ${unit.id}.`);
		if (!pageById.has(unit.app.practicePageId))
			fail(`Missing practice page ${unit.app.practicePageId} (${course.name}).`);
	}

	const coursePageIds = dataset.pages
		.filter((page) => page.courseId === course.id)
		.map((page) => page.id);
	const expectedPageIds = [
		course.app.practice.classPageId,
		...course.units.map((unit) => unit.app.practicePageId)
	];
	if (
		coursePageIds.length !== expectedPageIds.length ||
		coursePageIds.some((pageId, index) => pageId !== expectedPageIds[index])
	) {
		fail(`Practice page references differ from page index for ${course.name}.`);
	}
}

if (courseIds.size !== dataset.scope.appCourseCount)
	fail(`Expected ${dataset.scope.appCourseCount} unique course IDs, found ${courseIds.size}.`);
if (unitIds.size !== dataset.scope.appUnitCount)
	fail(`Expected ${dataset.scope.appUnitCount} unique unit IDs, found ${unitIds.size}.`);

const supportedFrqCourses = new Set(dataset.questionBank.frq.appSupportedCourses);
const profileCourses = new Set(
	dataset.courses.filter((course) => course.app.practice.frq.enabled).map((course) => course.name)
);
if (
	JSON.stringify([...supportedFrqCourses].sort()) !== JSON.stringify([...profileCourses].sort())
) {
	fail('Question-bank FRQ profiles and course practice flags differ.');
}

const requiredMcqFields = new Set(dataset.questionBank.mcq.schema.requiredFields);
for (const field of [
	'question',
	'optionA',
	'optionB',
	'optionC',
	'optionD',
	'correctAnswer',
	'explanation',
	'hint1',
	'hint2',
	'mainTopic',
	'topicsCovered'
]) {
	if (!requiredMcqFields.has(field)) fail(`MCQ schema is missing required field ${field}.`);
}
if (dataset.scope.questionInstancesIncluded !== false)
	fail('Question instances must not be embedded in this artifact.');
if (dataset.globalRules.dataIntegrity.questionInstancesExcluded !== true)
	fail('Question-instance exclusion rule is missing.');
if (dataset.research.exhaustiveCedObjectivesEmbedded !== false)
	fail('Exhaustive CED prose must remain linked rather than embedded.');

if (failures.length > 0) {
	console.error(failures.map((failure) => `- ${failure}`).join('\n'));
	process.exit(1);
}

console.log(
	JSON.stringify(
		{
			status: 'ok',
			courseCount: dataset.courses.length,
			unitCount: unitIds.size,
			practicePageCount: pageIds.size,
			sourceCount: dataset.sources.length,
			appFrqCourseCount: supportedFrqCourses.size,
			questionInstancesIncluded: dataset.scope.questionInstancesIncluded
		},
		null,
		2
	)
);
