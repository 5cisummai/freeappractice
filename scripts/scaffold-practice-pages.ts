/**
 * Generates src/lib/data/practice-pages.json from ap-classes.json and unit metadata.
 * Run: bun run scaffold:practice-pages
 */

import { writeFileSync } from 'node:fs';
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
	type: 'class' | 'unit';
	className: string;
	unitName?: string;
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
	const base = byUnit[unitNumber] ?? [
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

function buildUnitLinks(className: string, collegeBoardUrl: string | null): PracticePageLink[] {
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
		unitLabels.length > 3 ? unitLabels.slice(-2).join(' and ') : (unitLabels.at(-1) ?? '');

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
		links: buildUnitLinks(course.name, collegeBoardUrl)
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

	pages.sort((a, b) => a.slug.localeCompare(b.slug));

	writeFileSync(OUTPUT, `${JSON.stringify({ pages }, null, '\t')}\n`, 'utf8');
	console.log(`Wrote ${pages.length} practice pages to ${OUTPUT}`);
}

main();
