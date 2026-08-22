import dataset from '../src/lib/data/ap-classes-data-08212026.json';

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

const sourceIds = new Set(dataset.sources.map((source) => source.id));
const courseIds = new Set<string>();
const unitIds = new Set<string>();
const practicePages = dataset.courses
	.flatMap((course) => [
		course.app.practice.classPage,
		...course.units.map((unit) => unit.app.pageContent)
	])
	.filter((page): page is NonNullable<typeof page> => Boolean(page));
const practicePageSlugs = new Set(practicePages.map((page) => page.slug));

if (dataset.scope.appCourseCount !== 25)
	fail(`Expected 25 courses, found ${dataset.scope.appCourseCount}.`);
if (dataset.scope.appUnitCount !== 179)
	fail(`Expected 179 units, found ${dataset.scope.appUnitCount}.`);
if (dataset.courses.length !== 25)
	fail(`Dataset contains ${dataset.courses.length} course records.`);
if (dataset.scope.practicePageCount !== practicePages.length)
	fail(
		`Expected ${dataset.scope.practicePageCount} embedded practice pages, found ${practicePages.length}.`
	);
if (practicePageSlugs.size !== practicePages.length)
	fail('Embedded practice page slugs must be unique.');

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

for (const course of dataset.courses) {
	if (courseIds.has(course.id)) fail(`Duplicate course ID: ${course.id}.`);
	courseIds.add(course.id);

	const sourceReferences = collectSourceReferences(course);
	for (const sourceId of sourceReferences) {
		if (!sourceIds.has(sourceId))
			fail(`Missing source registry entry: ${sourceId} (${course.name}).`);
	}

	const expectedLabels = [
		...course.app.catalog.semester1UnitLabels,
		...course.app.catalog.semester2UnitLabels
	];
	const actualLabels = course.units.map((unit) => unit.label);
	if (JSON.stringify(expectedLabels) !== JSON.stringify(actualLabels)) {
		fail(`Unified app catalog labels/order differ from unit records for ${course.name}.`);
	}
	if (course.app.catalog.unitCount !== course.units.length)
		fail(`App unit count differs from unit records for ${course.name}.`);

	const classPage = course.app.practice.classPage;
	if (!classPage) {
		fail(`Missing class practice page for ${course.name}.`);
	} else if (
		classPage.slug !== course.app.practice.practicePageSlugs[0] ||
		classPage.type !== 'class' ||
		classPage.className !== course.name
	) {
		fail(`Class practice page mismatch for ${course.name}.`);
	}

	for (const unit of course.units) {
		if (unitIds.has(unit.id)) fail(`Duplicate unit ID: ${unit.id}.`);
		unitIds.add(unit.id);
		if (unit.app.practicePageSlug && !practicePageSlugs.has(unit.app.practicePageSlug)) {
			fail(`Missing practice page ${unit.app.practicePageSlug} (${course.name}).`);
		}
		if (unit.app.practicePageSlug !== unit.app.pageContent?.slug) {
			fail(`Practice page content mismatch for ${unit.id}.`);
		}
	}

	const embeddedCourseSlugs = new Set(
		[classPage?.slug, ...course.units.map((unit) => unit.app.pageContent?.slug)].filter(
			(slug): slug is string => Boolean(slug)
		)
	);
	for (const slug of course.app.practice.practicePageSlugs) {
		if (!practicePageSlugs.has(slug))
			fail(`Missing course practice page ${slug} (${course.name}).`);
		if (!embeddedCourseSlugs.has(slug))
			fail(`Course practice page ${slug} is not embedded under ${course.name}.`);
	}
	if (course.app.practice.practicePageSlugs.length !== embeddedCourseSlugs.size)
		fail(`Practice page references differ from embedded pages for ${course.name}.`);
}

if (unitIds.size !== 179) fail(`Expected 179 unique unit IDs, found ${unitIds.size}.`);

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
			practicePageCount: practicePageSlugs.size,
			sourceCount: dataset.sources.length,
			appFrqCourseCount: supportedFrqCourses.size,
			questionInstancesIncluded: dataset.scope.questionInstancesIncluded
		},
		null,
		2
	)
);
