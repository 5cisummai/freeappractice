import dataset from './ap-classes-data-08212026.json';
import practicePagesDataset from './practice-pages-data-09092026.json';

export const AP_DATA = dataset;
export const PRACTICE_PAGES_DATA = practicePagesDataset;
export type ApData = typeof AP_DATA;
export type PracticePagesData = typeof PRACTICE_PAGES_DATA;
export type UnifiedCourse = ApData['courses'][number];
export type UnifiedUnit = UnifiedCourse['units'][number];
export type UnifiedPage = PracticePagesData['pages'][number];

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

type PracticeFaqTemplate = {
	id: string;
	question: string;
	answer: string;
};

type PracticeFaqPageType = 'class' | 'unit';

const FAQ_TEMPLATES = PRACTICE_PAGES_DATA.faqTemplates as Record<
	PracticeFaqPageType,
	PracticeFaqTemplate[]
>;

function renderFaqTemplate(template: string, values: Record<string, string>): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function buildPracticePageFaq(
	type: PracticeFaqPageType,
	className: string,
	unit?: UnifiedUnit
): PracticeFaqTemplate[] {
	const unitName = unit?.label ?? '';
	const practiceLabel = unit ? `${className} ${unitName}` : className;
	const unitDescription = unit?.official.description ?? `${className} course content`;
	const values = { className, unitName, practiceLabel, unitDescription };

	return FAQ_TEMPLATES[type].map((template) => ({
		id: `${type}-${template.id}`,
		question: renderFaqTemplate(template.question, values),
		answer: renderFaqTemplate(template.answer, values)
	}));
}

/** SEO, article, and FAQ records projected from the dedicated practice-page dataset. */
export const PRACTICE_PAGES = PRACTICE_PAGES_DATA.pages.map((page) => {
	const course = courseById.get(page.courseId);
	if (!course) throw new Error(`Unknown practice page course: ${page.courseId}`);

	const unit = page.unitId ? unitById.get(page.unitId) : undefined;
	if (page.unitId && !unit) throw new Error(`Unknown practice page unit: ${page.unitId}`);
	const pageType: PracticeFaqPageType = page.type === 'unit' ? 'unit' : 'class';

	return {
		slug: page.id,
		type: pageType,
		className: course.name,
		...(unit ? { unitName: unit.label } : {}),
		seo: page.seo,
		article: page.article,
		links: page.links,
		faq: buildPracticePageFaq(pageType, course.name, unit)
	};
});
