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

function formatTopicsList(topics: string[], max = 4): string {
	if (topics.length === 0) return '';
	const selected = topics.slice(0, max);
	if (selected.length === 1) return selected[0]!;
	const last = selected.pop();
	return `${selected.join('; ')}; and ${last}`;
}

function pickClassExamFocus(className: string): string {
	if (
		className.includes('Calculus') ||
		className.includes('Statistics') ||
		className.includes('Precalculus')
	) {
		return `Strong ${className} scores come from linking graphs, tables, and algebraic work. Practice until you can justify answers with theorems and units, not just arrive at a number. Calculator-active and calculator-inactive items both reward clear setup.`;
	}
	if (
		className.includes('Physics') ||
		className.includes('Chemistry') ||
		className.includes('Biology') ||
		className.includes('Environmental')
	) {
		return `Science MCQs on ${className} often embed experiments, models, or data sets. Read the scenario first, identify what is held constant, then connect evidence to a claim. Vocabulary matters, but exam writers care more about whether you can explain a mechanism or trend.`;
	}
	if (className.includes('History') || className.includes('Government')) {
		return `${className} questions reward causal reasoning: how an event, policy, or ideology shaped what came next. Practice connecting people, institutions, and time periods instead of memorizing isolated years. Short stimuli on the exam still expect you to build an argument from evidence.`;
	}
	if (className.includes('English')) {
		return `${className} is argument and craft, not trivia. Practice identifying claims, evidence, and rhetorical moves under time pressure. The best prep pairs close reading with quick reflection on why a writer made a specific choice for a specific audience.`;
	}
	if (className.includes('Spanish') || className.includes('French')) {
		return `World-language AP exams test interpretation and cultural context alongside grammar. Practice reading for main idea, tone, and inference before worrying about every unknown word. Authentic sources on the exam are messy on purpose—they mirror real communication.`;
	}
	if (className.includes('Psychology') || className.includes('Economics')) {
		return `${className} MCQs love applied scenarios: a study design, a market shock, or a behavior in context. Name the concept, but always tie it back to the situation in the stem. Distinguishing similar terms (classical vs operant conditioning, change in demand vs quantity demanded) is where easy points hide.`;
	}
	if (className.includes('Computer Science')) {
		return `${className} blends conceptual questions with tracing code or evaluating algorithms. Practice explaining why a loop terminates, what a data structure buys you, and how abstraction reduces complexity. Speed helps, but accuracy on edge cases matters more than racing through easy stems.`;
	}
	return `${className} rewards steady unit-by-unit mastery. The exam rarely asks for trivia in isolation; it asks whether you can apply course frameworks to unfamiliar scenarios. Treat each practice question as a chance to rehearse that transfer.`;
}

function pickUnitExamVerb(className: string): string {
	if (className.includes('Calculus') || className.includes('Precalculus')) {
		return 'interpret rates, limits, or function behavior from multiple representations';
	}
	if (className.includes('Statistics')) {
		return 'reason about data, inference, and uncertainty from context';
	}
	if (className.includes('Physics')) {
		return 'set up models, interpret graphs, or justify answers with physical principles';
	}
	if (className.includes('Chemistry') || className.includes('Biology')) {
		return 'connect structure to function or explain experimental results';
	}
	if (className.includes('History') || className.includes('Government')) {
		return 'compare sources, explain causation, or place events in broader patterns';
	}
	if (className.includes('English')) {
		return 'analyze how specific choices shape argument and tone';
	}
	return 'apply course concepts to a scenario you have not memorized verbatim';
}

function pickUnitPracticeRoutine(label: string, courseName: string, unitNumber: number): string {
	const routines = [
		`For ${label}, treat each generated question as a two-minute drill: answer, then explain the correct choice in one sentence. That mirrors ${courseName} pacing better than silent clicking through endless sets.`,
		`Alternate untimed review with mildly timed sets on ${label}. Accuracy builds the foundation first; light time pressure later shows whether the ideas survived overnight.`,
		`Keep a running list of miss types for ${label}—vocabulary, setup, or inference. Three sessions with the same miss pattern mean reread that thread in your notes before generating more questions.`,
		`Pair ${label} MCQs with one sketch or outline per session. ${courseName} rewards multiple representations; translating a stem into a diagram or timeline catches gaps MCQs alone can hide.`,
		`When ${label} feels easy, increase difficulty by explaining why each wrong answer tempts you. That metacognition is what separates recognition from exam-ready mastery.`,
		`End each ${label} study block by writing one exam-style prompt you could ask a classmate. If you can write it, you probably understand what the College Board is probing.`
	];
	return routines[unitNumber % routines.length]!;
}

function isLunchCourse(className: string): boolean {
	return className.includes('Lunch');
}

function generateLunchUnitParagraphs(label: string, unitNumber: number): string[] {
	const byUnit: Record<number, string[]> = {
		1: [
			`Cafeteria line dynamics is the applied study of queues, bottlenecks, and strategic positioning when everyone is hungry and the bell is unforgiving.`,
			`Expect scenarios about throughput, tray balance, and why the pizza line always looks shorter until you commit. AP Lunch rewards systems thinking: identify the constraint before you optimize the wrong variable.`,
			`Practice explaining how splitting into multiple lines, pre-ordering sides, or coordinating with friends changes wait time—not just whether you are “lucky today.”`,
			`Strong answers name the trade-off: is shaving thirty seconds worth losing your usual seat, or is stability worth a longer queue?`,
			`Watch for distractors that confuse correlation (cool kids near the front) with causation (they actually arrived early).`,
			`When the stem mentions a sudden rush, ask what happened to arrival rate, service rate, and whether anyone opened a second register.`,
			`Generate questions here to rehearse lunch-line game theory without spilling your milk. Each explanation should leave you faster at reading a crowded room.`
		],
		2: [
			`Hot lunch versus packed lunch economics compares upfront cost, flexibility, and the hidden price of forgetting your water bottle again.`,
			`Practice trade-offs: cafeteria variety versus portion control, spontaneous fries versus meal-prep virtue, and the opportunity cost of standing in line when you could be reviewing flashcards.`,
			`AP Lunch loves marginal thinking—when is one more cookie worth it, and when does “I will eat it later” become a sunk-cost fallacy in your backpack?`,
			`Be ready to interpret supply shocks: pizza day increases demand; out-of-stock utensils shifts everyone to finger foods and regret.`,
			`Budget questions are not only about dollars—they are about whether you can still buy a drink after splurging on à la carte sides.`,
			`Nutrition stems may test whether adding protein actually keeps you awake through fifth period or just makes you sleepy in a warmer room.`,
			`Use this page to drill decision-making under lunch-period time pressure. The right answer usually respects budget, nutrition, and social logistics at once.`
		],
		3: [
			`Mystery meat identification trains observation, hypothesis testing, and the courage to ask a clarifying question before the first bite.`,
			`Practice distinguishing texture cues, sauce camouflage, and naming conventions that sound fancier than they taste.`,
			`AP Lunch experimental design: control for hunger level, prior exposure, and whether ketchup is acting as a confounding variable.`,
			`When a friend swears a dish is “fine,” treat that as anecdotal evidence, not data—sample size matters even at cafeteria tables.`,
			`Eliminate answers that violate basic food groups or plating logic before guessing among plausible proteins.`,
			`Cross-contamination and temperature cues belong in the same analysis: lukewarm trays change risk and flavor at once.`,
			`If a stem mentions gravy, decide whether it is hiding texture, temperature, or identity—that triple test saves you from confident wrong clicks on test day.`,
			`Generate MCQs here to sharpen sensory inference without relying on urban legends from last year’s seniors.`
		],
		4: [
			`Napkin folding theory explores efficiency, aesthetics, and whether your fold communicates “I have my life together” during a seven-minute lunch.`,
			`Practice scenarios about spill containment, sauce geometry, and collaborative table setups when friends arrive with trays and no plan.`,
			`AP Lunch questions may ask which fold minimizes surface area exposed to gravity—engineering disguised as etiquette.`,
			`Do not confuse decorative folds with functional ones when the stem describes a chili situation.`,
			`Teamwork stems test how many hands you need to clear space without knocking over someone else's chocolate milk.`,
			`Material limits matter: one-ply versus two-ply changes your confidence interval for surviving taco day.`,
			`When spills escalate, the best fold is the one you can deploy with one hand while holding a tray—practice recognizing that constraint.`,
			`Use this unit to rehearse spatial reasoning that is somehow still more practical than half the worksheets you have done this week.`
		],
		5: [
			`Trading snacks 101 models barter, fairness norms, and how repeated lunch-period deals build reputation capital.`,
			`Practice evaluating trades by value to you—not sticker price. Allergies, preferences, and timing all change what counts as a win.`,
			`AP Lunch loves prisoner's-dilemma setups: everyone benefits from sharing until someone hoards the good chips.`,
			`Document implicit contracts: who owes whom a cookie after Tuesday’s emergency lend.`,
			`Repeated interactions reward honesty; one-off trades reward caution—read the stem for which world you are in.`,
			`Watch for trades that look equal in calories but unequal in desirability—that is where utility, not math, decides.`,
			`If a classmate offers “half now, half later,” ask whether later ever arrives before the bell—time value of snacks is real.`,
			`Reputation effects linger: a reputation for fair trades gets you better offers next week than one clever win today.`,
			`Generate questions here to practice negotiation without turning the table into a market meltdown.`
		],
		6: [
			`Saving a table is coalition-building under uncertainty: jackets on chairs, one friend sprinting with trays, and the eternal threat of seniors on tour.`,
			`Practice allocating scouts, defenders, and runners when your group arrives at different times.`,
			`AP Lunch stems may test commitment devices—what signals a seat is truly taken versus politely negotiable?`,
			`Fairness matters: saving eight seats with one backpack fails the feasibility check every time.`,
			`Timing questions ask when to abandon a saved table because the line crossed a threshold you cannot recover from.`,
			`Communication failures cause more lost seats than malice—practice scenarios where nobody agreed who was holding the fort.`,
			`A good plan names a rendezvous time: if the group is not there by then, seats go back to the commons—no hard feelings, fewer wars.`,
			`Use this page to drill resource allocation strategies that would make your econ teacher proud and your friends less annoyed.`
		]
	};
	const base =
		byUnit[unitNumber] ?? [
			`${label} is a cornerstone unit in AP Lunch, where rigorous analysis meets the cafeteria clock.`,
			`Practice applying lunch-period logic to unfamiliar scenarios—because the exam writers respect creativity and a well-defended tray.`,
			`Generate questions here and read every explanation; tomorrow's line might be longer.`,
			`Treat each MCQ like a debate with your future self about whether you would make the same choice hungry.`,
			`When in doubt, pick the answer that respects time, fairness, and the laws of physics for a full tray.`
		];
	return [
		...base,
		`Lunch-period time limits make every decision visible: you either eat, socialize, or sprint to club—AP Lunch MCQs train you to commit after brief analysis instead of overthinking.`,
		`Hit Generate above for a fresh scenario. Wrong answers are useful here; the explanations are short enough to read before your friends sit down with their trays.`
	];
}

function pickUnitTrapWarning(label: string, topics: string[], unitNumber: number): string {
	const topicHint =
		topics.length > 0
			? `Watch for stems that swap closely related ideas from ${formatTopicsList(topics, 2)}.`
			: `Watch for answer choices that sound plausible but ignore a key condition in the stem.`;
	const warnings = [
		`A common miss on ${label} is choosing the definition you recognize instead of the one that fits the scenario. ${topicHint}`,
		`Time pressure makes ${label} tempting to rush—especially when numbers or dates appear in every option. Slow down enough to identify what the question is actually asking before eliminating distractors.`,
		`Students sometimes overfit ${label} to one classroom example. AP writers deliberately vary context; practice explaining the underlying rule so it travels to new settings.`,
		`If two answers feel half-right, ${label} questions usually reward the option tied to scale, evidence, or mechanism—not the more dramatic storyline.`
	];
	return warnings[unitNumber % warnings.length]!;
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

	const unitLabels = units.map((u) => stripUnitPrefix(u));
	const firstUnits = unitLabels.slice(0, 2).join(' and ');
	const laterUnits =
		unitLabels.length > 3 ? unitLabels.slice(-2).join(' and ') : unitLabels.at(-1) ?? '';

	const paragraphs = isLunchCourse(course.name)
		? [
				`${course.name} is the internet's most serious joke syllabus—and still a useful place to practice fast MCQs when you need a break from real AP stress.`,
				`Across ${units.length} units, you will study cafeteria systems, snack-market dynamics, and table-saving diplomacy with the same click-to-generate flow as every other subject on Free AP Practice.`,
				`Units move from ${firstUnits}${laterUnits && laterUnits !== firstUnits ? ` to ${laterUnits}` : ''}. Each page is self-contained, so you can hop between lunch topics without losing your streak on harder courses.`,
				`Humor aside, the practice engine is real: unlimited questions, instant explanations, and no signup. Treat it as a palate cleanser between heavier study blocks—or share it with a friend who needs a laugh before fifth period.`,
				`Pick a unit below, hit Generate, and read the explanation even when you guess right. The goal is quick thinking under silly constraints, which is oddly good training for timed exams.`,
				`When you are ready for scored AP prep, jump back to any core subject from the subjects list. Lunch will still be here when you need it.`,
				`Share a ridiculous question with a friend if it helps you reset before diving back into calculus or history. Low-stakes practice still trains the habit of reading carefully before you click.`
			]
		: [
				`${course.name} builds skills you will use on both multiple-choice and written-response sections of the AP exam. This page lets you generate unlimited practice questions for any unit in the course, with instant explanations and no account required.`,
				overview.endsWith('.')
					? `The College Board organizes the course around ${units.length} commonly taught units. ${overview}`
					: `The College Board organizes the course around ${units.length} commonly taught units: ${overview}.`,
				`You will move from ${firstUnits}${laterUnits && laterUnits !== firstUnits ? ` toward ${laterUnits}` : ''}. Practicing in that same order helps you reinforce what your class just covered—or preview what is coming if you are studying ahead over the summer.`,
				meta?.important_notes
					? `Before test day, keep this framing in mind: ${meta.important_notes}`
					: `Before test day, aim for accuracy first and speed second. Short daily sets beat marathon cram sessions, especially when you review misses the same day while the reasoning is still fresh.`,
				pickClassExamFocus(course.name),
				`Use this hub when you want a fast starting point: pick a unit below, click Generate, and read the explanation even when you are correct. You can switch units anytime without leaving the page.`
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
			? `College Board topic statements for this unit include ${formatTopicsList(topics)}.`
			: keywordsList.length > 0
				? `Key vocabulary and ideas to recognize include ${joinKeywords(keywordsList)}.`
				: `Review your class notes for ${label} and list the ideas your teacher repeated most—those recurring themes are usually what AP stems disguise in new contexts.`;

	const weightParagraph = weight
		? `On the ${course.name} exam, ${label} is weighted at roughly ${weight} of the multiple-choice section. That is enough to matter on score day even if your class spent only a few weeks here—especially when questions combine this unit with later material.`
		: `${label} is a core thread in ${course.name}. Even without a single posted weight, you will see these ideas recur on MCQs and free-response tasks that blend multiple units.`;

	const paragraphs = isLunchCourse(course.name)
		? generateLunchUnitParagraphs(label, unitNumber)
		: [
				opener,
				`${description} On the ${course.name} exam, items from ${label} often ask you to ${pickUnitExamVerb(course.name)} rather than recall isolated terms.`,
				topicSentence,
				weightParagraph,
				pickUnitTrapWarning(label, topics, unitNumber),
				pickStudyTip(unitNumber, course.name),
				pickUnitPracticeRoutine(label, course.name, unitNumber),
				`Use the generator above for fresh MCQs tied to ${label}. Answer, read the explanation, and log one sentence about why the correct choice works—that habit compounds faster than grinding endless worksheets.`
			].filter((paragraph) => paragraph.trim().length > 0);

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
			'Constitution questions on AP US History often tie founding debates to later political conflicts. Know not just what the document says, but why specific compromises—the three-fifths clause, the Great Compromise, the electoral college—were necessary to keep delegates at the Convention.',
			'Practice scenarios about the Federalist Papers, Anti-Federalist objections, and the Bill of Rights as a ratification bargain. A useful timeline anchors memory: weak Articles of Confederation by 1781, Philadelphia in 1787, ratification fights in 1788, and the first ten amendments in 1791.',
			'APUSH writers love asking how federalism, separation of powers, and checks and balances solve problems the Articles could not. Be ready to explain why Anti-Federalists feared concentrated power and why Federalists argued a stronger national government could still protect liberty.',
			'When you miss a question, note whether the trap was a date, a principle, or a historian’s interpretation. The exam rewards causal reasoning—how a compromise shaped later politics—more than isolated trivia lists.',
			'Pair MCQ practice with sketching how power flows between branches and levels of government. If you can explain the Constitution to a friend without reading notes, you are closer to exam-ready than you think.',
			'Generate questions here to rehearse founding-era arguments in fresh contexts. Each explanation is a chance to tighten the link between text, debate, and consequence.'
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
			'Civil War items usually connect antebellum sectionalism to wartime policy and Reconstruction outcomes. Trace how slavery expansion debates, failed compromises, and fears around Lincoln’s election escalated into secession—not as a single accident, but as a chain of choices.',
			'Know turning points—Antietam, Gettysburg, Vicksburg, Atlanta—for their political and diplomatic effects, not just battlefield outcomes. The Emancipation Proclamation’s timing matters because it reframed Union war aims and discouraged European recognition of the Confederacy.',
			'Practice linking military events to home-front morale, European recognition risks, and the shift toward a harder war. APUSH expects you to explain why the Union’s advantages in industry, railroads, and population mattered over time.',
			'Reconstruction is the epilogue students forget: amendments, Black political participation, and backlash policies show how the war’s end did not settle every conflict the war began. Questions often ask how wartime promises met postwar reality.',
			'When answer choices mention states’ rights, always ask rights to do what. Sectional arguments were rarely abstract; they were about the future of slavery and federal power.',
			'Use this page to generate fresh MCQs that force you to connect causes, conduct, and consequences without relying on one classroom lecture example.'
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
			'Photosynthesis questions frequently use graphs, diagrams, or mutant plant data. Review where ATP and NADPH are made versus where G3P is assembled into glucose—the thylakoid reactions and Calvin cycle are separate stages with separate inputs.',
			'Connect pigments, absorption spectra, and action spectra to electron flow in the thylakoid membrane. AP Bio tests mechanism: why a wavelength is absorbed, what happens when a photosystem is disrupted, how chemiosmosis links light energy to ATP.',
			'Expect experimental stems about light intensity, carbon dioxide availability, or herbicides that block specific enzymes. Always identify the independent variable and what the measured outcome actually reflects.',
			'Common traps confuse the light-dependent reactions with the Calvin cycle, or treat RuBP regeneration as the same step as carbon fixation. Sketch both cycles without notes until the carbon flow feels automatic.',
			'Pair MCQ practice with explaining how photorespiration or C4/CAM adaptations solve hot, dry conditions. Even when those topics appear in later units, photosynthesis questions assume you understand baseline C3 logic.',
			'Generate questions here to build speed reading chloroplast diagrams under time pressure. Each explanation should leave you able to teach the process in one minute.'
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
			'Natural selection items often present data from field studies or fossils and ask you to infer mechanism. Distinguish natural selection from genetic drift, gene flow, and mutation—each changes allele frequencies, but not always in the same direction or at the same speed.',
			'Review Hardy-Weinberg as a null model: what assumptions must hold for allele frequencies to stay stable? Deviations point to evolution in action and give AP writers easy experimental setups.',
			'Practice explaining why a trait increases fitness in a specific environment, not just defining vocabulary like adaptation or speciation. The exam loves camouflage, antibiotic resistance, and beak-size shifts because they show selection in context.',
			'Evidence for evolution spans homologous structures, molecular sequences, embryology, and the fossil record. Questions may ask which line of evidence best supports a claim—not which fact you memorized first.',
			'Watch for answer choices that describe change in individuals rather than populations. Selection acts on heritable variation across generations; one organism does not evolve in its lifetime.',
			'Use this page to rehearse linking data to mechanism. After each question, state the selective pressure and the outcome in one sentence.'
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
			'Limits are the language of derivatives and integrals on AP Calculus AB. Exam questions test algebraic manipulation, graphical interpretation, and whether you know when a limit does not exist—oscillation, unequal one-sided limits, or unbounded behavior all count.',
			'Watch for removable versus infinite discontinuities, and practice sandwich-theorem reasoning when direct substitution fails. A hole in a graph and a vertical asymptote are not the same story even when algebra looks similar at first.',
			'Continuity questions often hide inside piecewise functions. Check whether the limit equals the function value at the point of interest; differentiability will depend on that foundation in Unit 2.',
			'Keep limit notation precise: approaching from the left or right matters when definitions disagree. AP readers reward correct justification with theorem names when appropriate.',
			'If you can explain why a limit fails to exist using a graph and a sentence, derivative definitions become much easier to follow. The difference quotient is just limits in disguise.',
			'Generate practice MCQs here to drill setup before speed. Accuracy on edge cases beats racing through power-rule drills you already know.'
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
			'Derivative MCQs mix computation with meaning: instantaneous rate, slope of tangent, and relationship to average rate on an interval. AP Calculus AB expects you to move between graphs, tables, and symbolic forms without getting stuck in one representation.',
			'Keep the difference quotient and limit definition fresh even after you master shortcuts. The exam occasionally tests conceptual understanding—whether a function is differentiable at a corner or cusp—not just whether you can apply the power rule quickly.',
			'Sign charts and interpretations of f′ matter early: where is the function increasing? Where is concavity changing? Those reading skills preview optimization and related-rates units later in the course.',
			'Units on derivatives are calculator-active and inactive. Practice estimating slopes from tables and recognizing when a graph’s steepness contradicts an algebraic guess.',
			'Chain-rule thinking starts here even before the name appears everywhere. Ask what inner and outer behavior are doing whenever a function is nested.',
			'Use this page to generate fresh derivative questions with explanations. After each item, say in words what the derivative represents in context—velocity, marginal cost, or slope—not just the symbol f′(x).'
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
			'Stoichiometry underpins much of AP Chemistry. Errors in mole ratios cascade into equilibrium, acid–base, and thermochemistry problems later in the year, so this topic is worth slow, careful reps—not one rushed night.',
			'Practice identifying limiting reactants from word problems and lab data, not just balanced equations on paper. The exam loves mixtures where one reagent runs out first and leaves excess behind.',
			'Percent yield and theoretical yield questions test whether you connect the real world to ideal ratios. Always track units: moles, liters at STP, grams, and molarity are interchangeable only when setup is correct.',
			'Solution stoichiometry ties molarity to reaction ratios. Dilution is not stoichiometry by itself—know when a problem is about concentration change versus mole consumption in a reaction.',
			'Use the formula sheet for constants, but prioritize setting up ratios with correct units first. A correct setup with arithmetic noise is easier to fix than a wrong mole ratio copied from the stem.',
			'Generate unlimited MCQs here to build automaticity before timed sets. Each explanation should leave you able to narrate the mole map for that scenario.'
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
			'Silk Road questions emphasize exchange: goods, ideas, religions, technologies, and pathogens moving across Afro-Eurasia. Compare continuity and change before and after major empires rather than treating the network as a single static road.',
			'Link trade to urban growth, syncretic belief systems, and the spread of paper, gunpowder, or crops. AP World wants global patterns—who benefited, who mediated risk, who lost when routes shifted—not isolated country facts.',
			'Pastoral nomads, oasis cities, and imperial protection all shaped how safe and profitable segments were. A question about decline might be about maritime routes, political fragmentation, or new technologies—not just “the road closed.”',
			'Disease exchange belongs in the same story as luxury goods. Epidemics could reorganize labor, faith, and state capacity across regions that never met directly on a map.',
			'CCOT-style thinking helps: what stayed constant in Eurasian exchange before 1450, and what transformed when Mongol peace or later disruptions reweighted power?',
			'Practice here with generated MCQs that force you to justify comparisons. After each answer, name the mechanism of exchange—trade, conquest, migration, or mission—that best fits the stem.'
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
			'Memory questions often describe experiments—Ebbinghaus forgetting curves, Loftus eyewitness work, HM case studies—and ask you to name the process or predict interference effects. Read the scenario before jumping to a vocabulary word.',
			'Distinguish explicit versus implicit memory, proactive versus retroactive interference, and levels-of-processing predictions. AP Psychology rewards matching task demands to memory system, not labeling everything “short-term.”',
			'Models matter: Atkinson-Shiffrin versus working memory updates explain different failure modes. Be ready to say what capacity or duration each model emphasizes and where real data broke the simple story.',
			'Brain structures enter as mechanisms, not flashcards. Hippocampus consolidation, amygdala emotion tagging, and cerebellum procedural learning each predict distinct deficits—use case studies to anchor them.',
			'Encoding tricks—chunking, mnemonics, spacing—show up as applied questions. Ask what the study changed about encoding or retrieval, not just whether participants “remembered more.”',
			'Generate MCQs here to practice fast scenario sorting. One sentence after each item: what memory process failed or succeeded, and why.'
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
			'Rhetorical analysis on AP English Language is about how choices create meaning, not listing devices without purpose. Always tie technique to audience, exigence, and the writer’s purpose—ethos, pathos, and logos are tools, not answers by themselves.',
			'Practice identifying thesis, line of reasoning, and counterarguments in short passages. MCQs often ask what a shift in tone or syntax accomplishes rather than naming the shift alone.',
			'Syntax questions reward close reading: periodic sentences, anaphora, juxtaposition, and concession-refutation patterns each do different rhetorical work. Ask what changes in the reader’s attention when the structure shifts.',
			'Evidence quality matters as much as evidence quantity. A writer can cite statistics, anecdotes, or expert testimony—but the exam checks whether you see how that evidence supports the claim at hand.',
			'Speed comes from pattern recognition paired with restraint. The best students explain effect in one tight clause: not “metaphor” but “compares X to Y to stress Z.”',
			'Use generated questions here to drill effect-first analysis under time pressure. Each explanation is practice translating craft into argument.'
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
		article: {
			paragraphs: [
				...def.paragraphs,
				`Focused practice on ${def.customTopic} beats rereading the same chapter summary. Return here between homework sets to keep ${def.className} reasoning sharp without committing to a full review block.`,
				`Each generated MCQ includes an instant explanation—use it to rewrite the idea in your own words before closing the tab. That one-sentence recap is how topic drills turn into long-term memory before May.`
			]
		},
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
