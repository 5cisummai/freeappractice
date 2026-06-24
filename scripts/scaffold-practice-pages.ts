/**
 * Generates src/lib/data/practice-pages.json from ap-classes.json and unit metadata.
 * Run: pnpm scaffold:practice-pages
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import apClassesData from '../src/lib/data/ap-classes.json';
import unitDescriptionsData from '../src/lib/data/unit-descriptionsrevised.json';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '../src/lib/data/practice-pages.json');

type Course = { name: string; semester1: string[]; semester2: string[] };

type UnitMeta = {
	unit_number: number;
	unit_title: string;
	keywords: string[];
	exam_weighting_mc?: string;
	description: string;
	topics_may_include: string[];
};

type CourseMeta = {
	course_name: string;
	overview: string;
	important_notes?: string;
	sources?: string[];
	units: UnitMeta[];
};

type PracticePageLink = {
	label: string;
	href: string;
	kind: 'college-board' | 'subject-tool' | 'blog' | 'external';
};

type PracticePage = {
	slug: string;
	type: 'class' | 'unit' | 'topic';
	className: string;
	unitName?: string;
	customTopic?: string;
	seo: {
		title: string;
		description: string;
		keywords?: string;
		h1: string;
		subtitle?: string;
	};
	article: { paragraphs: string[] };
	links: PracticePageLink[];
};

function classToSlug(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/[\s_]+/g, '-')
		.replace(/-+/g, '-');
}

function unitToSlug(unitName: string): string {
	const match = unitName.match(/(?:Unit|Big Idea)\s+(\d+)/i);
	if (!match) throw new Error(`Cannot derive slug from "${unitName}"`);
	return `unit-${match[1]}`;
}

function extractUnitNumber(unitName: string): number {
	const match = unitName.match(/(?:Unit|Big Idea)\s+(\d+)/i);
	if (!match) throw new Error(`Cannot extract number from "${unitName}"`);
	return Number.parseInt(match[1]!, 10);
}

function extractCollegeBoardUrl(sources?: string[]): string | null {
	if (!sources?.length) return null;
	for (const source of sources) {
		const match = source.match(/\((https:\/\/apcentral\.collegeboard\.org[^)]+)\)/);
		if (match?.[1]) return match[1].replace(/\?utm_source=openai$/, '');
	}
	return null;
}

function stripUnitPrefix(unitName: string): string {
	return unitName.replace(/^(?:Unit|Big Idea)\s+\d+:\s*/, '');
}

function joinKeywords(keywords: string[], max = 4): string {
	return keywords.slice(0, max).join(', ');
}

function pickStudyTip(unitNumber: number, className: string): string {
	const tips = [
		`After each practice question, write one sentence explaining why the correct answer works. That habit transfers directly to ${className} exam reasoning.`,
		`Mix MCQ practice with sketching diagrams or timelines from memory. ${className} rewards recall under time pressure, not just recognition.`,
		`When you miss a question, tag it by skill (vocabulary, calculation, inference). Patterns in your misses show where to reread your notes.`,
		`Try explaining this unit's core idea to someone else in under 60 seconds. If the explanation drifts, you found a gap worth fixing before test day.`,
		`Alternate timed sets with untimed review. Speed matters on exam day, but accuracy during study builds the foundation.`,
		`Connect new terms to one anchor example you already understand. Isolated definitions fade; anchored ones stick through May.`
	];
	return tips[unitNumber % tips.length]!;
}

function buildClassLinks(className: string, collegeBoardUrl: string | null): PracticePageLink[] {
	const links: PracticePageLink[] = [];
	if (collegeBoardUrl) {
		links.push({
			label: `${className} on AP Central`,
			href: collegeBoardUrl,
			kind: 'college-board'
		});
	}

	if (className.includes('History') || className.includes('Government')) {
		links.push({
			label: 'Summer AP study guide',
			href: '/summer',
			kind: 'blog'
		});
	}

	return links.slice(0, 3);
}

function buildUnitLinks(
	className: string,
	collegeBoardUrl: string | null,
	unitNumber: number
): PracticePageLink[] {
	const links = buildClassLinks(className, collegeBoardUrl);
	const classSlug = classToSlug(className);
	links.unshift({
		label: `All ${className} practice`,
		href: `/practice/${classSlug}`,
		kind: 'external'
	});
	return links.slice(0, 3);
}

function generateClassPage(course: Course, meta: CourseMeta | undefined): PracticePage {
	const slug = classToSlug(course.name);
	const units = [...course.semester1, ...course.semester2];
	const collegeBoardUrl = extractCollegeBoardUrl(meta?.sources);
	const overview =
		meta?.overview ??
		`${course.name} is organized into ${units.length} commonly taught units aligned with the College Board course framework.`;

	const unitListSample = units
		.slice(0, 3)
		.map((u) => stripUnitPrefix(u))
		.join(', ');

	const paragraphs = [
		`${course.name} builds skills you will use on both multiple-choice and written-response sections of the AP exam. This page lets you generate unlimited practice questions for any unit in the course, with instant explanations and no account required.`,
		`The course spans ${units.length} units, starting with ${unitListSample}${units.length > 3 ? ', and more' : ''}. Working unit by unit mirrors how most teachers pace the year and helps you spot weak areas early.`,
		meta?.important_notes
			? `Exam tip: ${meta.important_notes.split('.')[0]}.`
			: `Pick a unit below, click Generate, and treat each question like a mini quiz. Review wrong answers the same day while the reasoning is still fresh.`,
		`Use this hub when you know the subject but want a fast starting point. You can change units anytime without leaving the page.`
	];

	const keywords = [
		`${course.name} practice`,
		`free ${course.name} questions`,
		`${course.name} MCQ practice`,
		`${course.name} exam prep`,
		'AP practice no signup'
	].join(', ');

	return {
		slug,
		type: 'class',
		className: course.name,
		seo: {
			title: `Free ${course.name} Practice Questions | FreeAPPractice.org`,
			description: `Practice ${course.name} with free, unlimited MCQs. Pick any unit, generate exam-style questions, and get instant feedback. No signup required.`,
			keywords,
			h1: `Free ${course.name} Practice`,
			subtitle: `${units.length} units. Unlimited questions. Instant explanations.`
		},
		article: { paragraphs },
		links: buildClassLinks(course.name, collegeBoardUrl)
	};
}

function generateUnitPage(
	course: Course,
	unitName: string,
	meta: CourseMeta | undefined
): PracticePage {
	const classSlug = classToSlug(course.name);
	const unitSlug = unitToSlug(unitName);
	const slug = `${classSlug}/${unitSlug}`;
	const unitNumber = extractUnitNumber(unitName);
	const unitMeta = meta?.units.find((u) => u.unit_number === unitNumber);
	const label = stripUnitPrefix(unitName);
	const collegeBoardUrl = extractCollegeBoardUrl(meta?.sources);

	const weight = unitMeta?.exam_weighting_mc;
	const topics = unitMeta?.topics_may_include ?? [];
	const keywordsList = unitMeta?.keywords ?? [];
	const description =
		unitMeta?.description ?? `${label} covers core ${course.name} concepts tested on the AP exam.`;

	const angle = unitNumber % 4;
	let opener: string;
	if (angle === 0 && weight) {
		opener = `${label} typically accounts for about ${weight} of the ${course.name} multiple-choice section. That makes it worth dedicated practice even if your class spent only a few weeks on it.`;
	} else if (angle === 1) {
		opener = `Students often underestimate ${label} because it appears early in the syllabus, but AP questions here test application, not memorized definitions alone.`;
	} else if (angle === 2) {
		opener = `${label} connects to later units in ${course.name}. Solid practice now reduces rework when those ideas reappear in combined scenarios.`;
	} else {
		opener = `This page is set up for ${course.name} ${label}. Generate a question, answer it, and read the explanation before moving on.`;
	}

	const topicSentence =
		topics.length > 0
			? `Expect questions involving ${topics.slice(0, 3).join('; ')}.`
			: keywordsList.length > 0
				? `Key ideas include ${joinKeywords(keywordsList)}.`
				: '';

	const paragraphs = [
		opener,
		`${description} ${topicSentence}`.trim(),
		pickStudyTip(unitNumber, course.name),
		`Select Generate above to pull a fresh MCQ for this unit. You can still switch subjects or units if you want to compare topics side by side.`
	];

	const seoKeywords = [
		`${course.name} ${label}`,
		`${course.name} unit ${unitNumber} practice`,
		`${course.name} MCQ`,
		`AP ${label} questions`,
		'free AP practice'
	].join(', ');

	return {
		slug,
		type: 'unit',
		className: course.name,
		unitName,
		seo: {
			title: `${course.name} ${label} Practice Questions | FreeAPPractice.org`,
			description: `Free ${course.name} practice for ${label}. Generate unlimited MCQs with instant explanations.${weight ? ` Covers ~${weight} of the MC section.` : ''} No signup.`,
			keywords: seoKeywords,
			h1: `${course.name}: ${label}`,
			subtitle: weight ? `~${weight} of multiple-choice exam weight` : undefined
		},
		article: { paragraphs },
		links: buildUnitLinks(course.name, collegeBoardUrl, unitNumber)
	};
}

const TOPIC_PAGES: Array<{
	slugSuffix: string;
	className: string;
	customTopic: string;
	seo: PracticePage['seo'];
	paragraphs: string[];
	extraLinks?: PracticePageLink[];
}> = [
	{
		slugSuffix: 'constitution',
		className: 'AP US History',
		customTopic: 'Constitution',
		seo: {
			title: 'AP US History Constitution Practice Questions | FreeAPPractice.org',
			description:
				'Practice APUSH Constitution topics with free MCQs: Articles of Confederation, Constitutional Convention, Federalist vs Anti-Federalist debates, and the Bill of Rights.',
			h1: 'AP US History: The Constitution',
			subtitle: 'Founding documents, compromises, and ratification'
		},
		paragraphs: [
			'Constitution questions on AP US History often tie founding debates to later political conflicts. Know not just what the document says, but why specific compromises (three-fifths, Great Compromise, electoral college) existed.',
			'Practice scenarios about Federalist Papers, Anti-Federalist objections, and the Bill of Rights as a ratification bargain. Timelines help: 1781 Articles weaknesses, 1787 Convention, 1788 ratification, 1791 first ten amendments.',
			'When you miss a question, note whether the trap was a date, a principle (separation of powers, federalism), or a historian interpretation. APUSH rewards causal reasoning over trivia lists.'
		],
		extraLinks: [
			{
				label: 'National Constitution Center: Interactive Constitution',
				href: 'https://constitutioncenter.org/interactive-constitution',
				kind: 'external'
			}
		]
	},
	{
		slugSuffix: 'civil-war',
		className: 'AP US History',
		customTopic: 'Civil War',
		seo: {
			title: 'AP US History Civil War Practice Questions | FreeAPPractice.org',
			description:
				'Free APUSH Civil War MCQ practice: causes, military turning points, emancipation, and Reconstruction links. Instant explanations, no signup.',
			h1: 'AP US History: Civil War',
			subtitle: 'Causes, conduct, and consequences'
		},
		paragraphs: [
			'Civil War items usually connect antebellum sectionalism to wartime policy and Reconstruction outcomes. Trace how slavery expansion debates, failed compromises, and Lincoln election fears escalated into secession.',
			'Know turning points (Antietam, Gettysburg, Vicksburg, Atlanta) for their political and diplomatic effects, not just battlefield outcomes. Emancipation Proclamation timing matters for Union war aims.',
			'Generate questions here to practice linking military events to home front morale, European recognition risks, and the shift toward a harder war.'
		]
	},
	{
		slugSuffix: 'photosynthesis',
		className: 'AP Biology',
		customTopic: 'Photosynthesis',
		seo: {
			title: 'AP Biology Photosynthesis Practice Questions | FreeAPPractice.org',
			description:
				'Practice AP Biology photosynthesis MCQs: light reactions, Calvin cycle, chloroplast structure, and experimental data. Free, unlimited, instant feedback.',
			h1: 'AP Biology: Photosynthesis',
			subtitle: 'Light-dependent and light-independent reactions'
		},
		paragraphs: [
			'Photosynthesis questions frequently use graphs, diagrams, or mutant plant data. Review where ATP and NADPH are made versus where G3P is assembled into glucose.',
			'Connect pigments, absorption spectra, and action spectra to the flow of electrons in the thylakoid membrane. AP Bio tests mechanism, not just labeling a chloroplast.',
			'Pair MCQ practice with sketching the Calvin cycle inputs and outputs without looking at notes. If you confuse regeneration of RuBP with carbon fixation, that gap will show up here.'
		]
	},
	{
		slugSuffix: 'natural-selection',
		className: 'AP Biology',
		customTopic: 'Natural Selection',
		seo: {
			title: 'AP Biology Natural Selection Practice Questions | FreeAPPractice.org',
			description:
				'Free AP Biology natural selection MCQs: variation, selection pressures, evidence for evolution, and population genetics basics.',
			h1: 'AP Biology: Natural Selection',
			subtitle: 'Mechanisms and evidence for evolution'
		},
		paragraphs: [
			'Natural selection items often present data from field studies or fossils and ask you to infer mechanism. Distinguish natural selection from genetic drift, gene flow, and mutation.',
			'Review Hardy-Weinberg as a null model: what assumptions must hold for allele frequencies to stay stable? Deviations point to evolution in action.',
			'Use this page to practice explaining why a trait increases fitness in a specific environment, not just defining evolution vocabulary.'
		]
	},
	{
		slugSuffix: 'limits',
		className: 'AP Calculus AB',
		customTopic: 'Limits',
		seo: {
			title: 'AP Calculus AB Limits Practice Questions | FreeAPPractice.org',
			description:
				'Free AP Calc AB limits MCQs: one-sided limits, continuity, infinite limits, and limit laws. Generate unlimited questions with step-by-step reasoning.',
			h1: 'AP Calculus AB: Limits',
			subtitle: 'Continuity and limit notation'
		},
		paragraphs: [
			'Limits are the language of derivatives and integrals. AP questions test algebraic manipulation, graphical interpretation, and whether you know when a limit does not exist.',
			'Watch for removable versus infinite discontinuities, and practice sandwich theorem style reasoning when direct substitution fails.',
			'If you can justify continuity at a point using limit notation, Unit 2 derivatives become much easier to follow.'
		]
	},
	{
		slugSuffix: 'derivatives',
		className: 'AP Calculus AB',
		customTopic: 'Derivatives',
		seo: {
			title: 'AP Calculus AB Derivatives Practice Questions | FreeAPPractice.org',
			description:
				'Practice AP Calc AB derivatives: definition, power rule, tangent lines, and rate interpretation. Free MCQs with instant feedback.',
			h1: 'AP Calculus AB: Derivatives',
			subtitle: 'Definition, rules, and rate of change'
		},
		paragraphs: [
			'Derivative MCQs mix computation with meaning: instantaneous rate, slope of tangent, and relationship to average rate on an interval.',
			'Keep difference quotient and limit definition fresh even after you master shortcuts. AP occasionally tests conceptual understanding over speed.',
			'Generate problems here to drill chain rule precursors and interpreting f′(x) sign charts before optimization units.'
		]
	},
	{
		slugSuffix: 'stoichiometry',
		className: 'AP Chemistry',
		customTopic: 'Stoichiometry',
		seo: {
			title: 'AP Chemistry Stoichiometry Practice Questions | FreeAPPractice.org',
			description:
				'Free AP Chemistry stoichiometry MCQs: mole ratios, limiting reactant, percent yield, and solution stoichiometry. Unlimited practice, no signup.',
			h1: 'AP Chemistry: Stoichiometry',
			subtitle: 'Mole relationships and reaction yields'
		},
		paragraphs: [
			'Stoichiometry underpins much of AP Chemistry. Errors in mole ratios cascade into equilibrium and thermochemistry problems later in the year.',
			'Practice identifying limiting reactants from word problems and lab data, not just balanced equations on paper.',
			'Use the formula sheet link below for molarity and gas law constants, but focus on setting up ratios with correct units first.'
		]
	},
	{
		slugSuffix: 'silk-road',
		className: 'AP World History',
		customTopic: 'Silk Road',
		seo: {
			title: 'AP World History Silk Road Practice Questions | FreeAPPractice.org',
			description:
				'Practice AP World Silk Road MCQs: trade networks, cultural diffusion, technologies, and disease exchange across Afro-Eurasia.',
			h1: 'AP World History: Silk Road',
			subtitle: 'Exchange networks before 1450'
		},
		paragraphs: [
			'Silk Road questions emphasize exchange: goods, ideas, religions, technologies, and pathogens moving across regions. Compare continuity and change before and after major empires.',
			'Link trade to urban growth, syncretic belief systems, and the spread of paper, gunpowder, or crops. AP World wants global patterns, not isolated country facts.',
			'Generate questions to practice CCOT-style thinking about how pastoral nomads, oasis cities, and imperial protection shaped network safety.'
		]
	},
	{
		slugSuffix: 'memory',
		className: 'AP Psychology',
		customTopic: 'Memory',
		seo: {
			title: 'AP Psychology Memory Practice Questions | FreeAPPractice.org',
			description:
				'Free AP Psych memory MCQs: encoding, storage, retrieval, models (Atkinson-Shiffrin, working memory), and forgetting.',
			h1: 'AP Psychology: Memory',
			subtitle: 'Encoding, storage, and retrieval'
		},
		paragraphs: [
			'Memory questions often describe experiments (Ebbinghaus, Loftus eyewitness, HM case study) and ask you to name the process or predict interference effects.',
			'Distinguish explicit versus implicit memory, proactive versus retroactive interference, and levels-of-processing predictions.',
			'Use this page to connect brain structures (hippocampus, amygdala) to specific memory failures without oversimplifying case studies.'
		]
	},
	{
		slugSuffix: 'rhetorical-analysis',
		className: 'AP English Language',
		customTopic: 'Rhetorical Analysis',
		seo: {
			title: 'AP English Language Rhetorical Analysis Practice | FreeAPPractice.org',
			description:
				'Practice AP Lang rhetorical analysis MCQs: ethos, pathos, logos, tone, syntax, and argument structure. Free with instant feedback.',
			h1: 'AP English Language: Rhetorical Analysis',
			subtitle: 'Claims, evidence, and rhetorical choices'
		},
		paragraphs: [
			'Rhetorical analysis on AP Lang is about how choices create meaning, not listing devices without purpose. Always tie technique to audience and exigence.',
			'Practice identifying thesis, line of reasoning, and counterarguments in short passages. MCQs often ask what a shift in tone or syntax accomplishes.',
			'Generate questions here to build speed recognizing patterns: concession-refutation, anaphora for emphasis, or juxtaposition to highlight contrast.'
		]
	}
];

function generateTopicPage(
	def: (typeof TOPIC_PAGES)[number],
	meta: CourseMeta | undefined
): PracticePage {
	const classSlug = classToSlug(def.className);
	const slug = `${classSlug}/${def.slugSuffix}`;
	const collegeBoardUrl = extractCollegeBoardUrl(meta?.sources);
	const links = [
		{
			label: `All ${def.className} practice`,
			href: `/practice/${classSlug}`,
			kind: 'external' as const
		},
		...(def.extraLinks ?? []),
		...buildClassLinks(def.className, collegeBoardUrl)
	];

	const seen = new Set<string>();
	const uniqueLinks = links.filter((link) => {
		if (seen.has(link.href)) return false;
		seen.add(link.href);
		return true;
	});

	return {
		slug,
		type: 'topic',
		className: def.className,
		customTopic: def.customTopic,
		seo: def.seo,
		article: { paragraphs: def.paragraphs },
		links: uniqueLinks.slice(0, 3)
	};
}

function main(): void {
	const courses = (apClassesData as { courses: Course[] }).courses;
	const courseMetaList = (unitDescriptionsData as { courses: CourseMeta[] }).courses;
	const metaByName = new Map(courseMetaList.map((c) => [c.course_name, c]));

	const pages: PracticePage[] = [];

	for (const course of courses) {
		const meta = metaByName.get(course.name);
		pages.push(generateClassPage(course, meta));

		for (const unitName of [...course.semester1, ...course.semester2]) {
			pages.push(generateUnitPage(course, unitName, meta));
		}
	}

	for (const topicDef of TOPIC_PAGES) {
		const meta = metaByName.get(topicDef.className);
		pages.push(generateTopicPage(topicDef, meta));
	}

	// Preserve any manually added topic pages not in TOPIC_PAGES
	try {
		const existing = JSON.parse(readFileSync(OUTPUT, 'utf8')) as { pages: PracticePage[] };
		const generatedSlugs = new Set(pages.map((p) => p.slug));
		for (const page of existing.pages ?? []) {
			if (page.type === 'topic' && !generatedSlugs.has(page.slug)) {
				pages.push(page);
			}
		}
	} catch {
		// No existing file or invalid JSON
	}

	pages.sort((a, b) => a.slug.localeCompare(b.slug));

	writeFileSync(OUTPUT, `${JSON.stringify({ pages }, null, '\t')}\n`, 'utf8');
	console.log(`Wrote ${pages.length} practice pages to ${OUTPUT}`);
}

main();
