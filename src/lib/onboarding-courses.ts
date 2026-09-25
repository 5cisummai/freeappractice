import AtomIcon from '@tabler/icons-svelte/icons/atom';
import BarChart3Icon from '@tabler/icons-svelte/icons/chart-pie-filled';
import BookOpenIcon from '@tabler/icons-svelte/icons/book-filled';
import BrainIcon from '@tabler/icons-svelte/icons/brain';
import CalculatorIcon from '@tabler/icons-svelte/icons/calculator-filled';
import Code2Icon from '@tabler/icons-svelte/icons/code';
import DumbbellIcon from '@tabler/icons-svelte/icons/dumbbell';
import FlaskConicalIcon from '@tabler/icons-svelte/icons/flask-filled';
import Globe2Icon from '@tabler/icons-svelte/icons/world-filled';
import LandmarkIcon from '@tabler/icons-svelte/icons/building-bank';
import LanguagesIcon from '@tabler/icons-svelte/icons/language';
import LeafIcon from '@tabler/icons-svelte/icons/leaf-filled';
import type { Component } from 'svelte';
import { getCourses } from '$lib/catalog/ap-courses.js';

type CourseIcon = Component<{ class?: string }>;

const asCourseIcon = (icon: unknown) => icon as CourseIcon;

export type OnboardingCourse = {
	name: string;
	icon: CourseIcon;
	description: string;
	iconClass: string;
	checkedClass: string;
};

type CourseColor =
	| 'sky'
	| 'emerald'
	| 'violet'
	| 'indigo'
	| 'cyan'
	| 'purple'
	| 'amber'
	| 'teal'
	| 'rose'
	| 'orange'
	| 'blue'
	| 'primary';

const COURSE_COLOR_THEMES: Record<
	CourseColor,
	{
		iconClass: string;
		checkedClass: string;
	}
> = {
	sky: {
		iconClass: 'bg-sky-100 text-sky-600 dark:bg-sky-950/80 dark:text-sky-400',
		checkedClass:
			'has-[:checked]:border-sky-400/70 has-[:checked]:bg-sky-500/15 has-[:checked]:[&_.course-icon]:bg-sky-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-sky-500 has-[:checked]:[&_.selection-check]:text-sky-600 dark:has-[:checked]:[&_.selection-check]:text-sky-400'
	},
	emerald: {
		iconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
		checkedClass:
			'has-[:checked]:border-emerald-400/70 has-[:checked]:bg-emerald-500/15 has-[:checked]:[&_.course-icon]:bg-emerald-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-emerald-500 has-[:checked]:[&_.selection-check]:text-emerald-600 dark:has-[:checked]:[&_.selection-check]:text-emerald-400'
	},
	violet: {
		iconClass: 'bg-violet-100 text-violet-600 dark:bg-violet-950/80 dark:text-violet-400',
		checkedClass:
			'has-[:checked]:border-violet-400/70 has-[:checked]:bg-violet-500/15 has-[:checked]:[&_.course-icon]:bg-violet-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-violet-500 has-[:checked]:[&_.selection-check]:text-violet-600 dark:has-[:checked]:[&_.selection-check]:text-violet-400'
	},
	indigo: {
		iconClass: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400',
		checkedClass:
			'has-[:checked]:border-indigo-400/70 has-[:checked]:bg-indigo-500/15 has-[:checked]:[&_.course-icon]:bg-indigo-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-indigo-500 has-[:checked]:[&_.selection-check]:text-indigo-600 dark:has-[:checked]:[&_.selection-check]:text-indigo-400'
	},
	cyan: {
		iconClass: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/80 dark:text-cyan-400',
		checkedClass:
			'has-[:checked]:border-cyan-400/70 has-[:checked]:bg-cyan-500/15 has-[:checked]:[&_.course-icon]:bg-cyan-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-cyan-500 has-[:checked]:[&_.selection-check]:text-cyan-600 dark:has-[:checked]:[&_.selection-check]:text-cyan-400'
	},
	purple: {
		iconClass: 'bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400',
		checkedClass:
			'has-[:checked]:border-purple-400/70 has-[:checked]:bg-purple-500/15 has-[:checked]:[&_.course-icon]:bg-purple-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-purple-500 has-[:checked]:[&_.selection-check]:text-purple-600 dark:has-[:checked]:[&_.selection-check]:text-purple-400'
	},
	amber: {
		iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400',
		checkedClass:
			'has-[:checked]:border-amber-400/70 has-[:checked]:bg-amber-500/15 has-[:checked]:[&_.course-icon]:bg-amber-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-amber-500 has-[:checked]:[&_.selection-check]:text-amber-600 dark:has-[:checked]:[&_.selection-check]:text-amber-400'
	},
	teal: {
		iconClass: 'bg-teal-100 text-teal-600 dark:bg-teal-950/80 dark:text-teal-400',
		checkedClass:
			'has-[:checked]:border-teal-400/70 has-[:checked]:bg-teal-500/15 has-[:checked]:[&_.course-icon]:bg-teal-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-teal-500 has-[:checked]:[&_.selection-check]:text-teal-600 dark:has-[:checked]:[&_.selection-check]:text-teal-400'
	},
	rose: {
		iconClass: 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400',
		checkedClass:
			'has-[:checked]:border-rose-400/70 has-[:checked]:bg-rose-500/15 has-[:checked]:[&_.course-icon]:bg-rose-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-rose-500 has-[:checked]:[&_.selection-check]:text-rose-600 dark:has-[:checked]:[&_.selection-check]:text-rose-400'
	},
	orange: {
		iconClass: 'bg-orange-100 text-orange-600 dark:bg-orange-950/80 dark:text-orange-400',
		checkedClass:
			'has-[:checked]:border-orange-400/70 has-[:checked]:bg-orange-500/15 has-[:checked]:[&_.course-icon]:bg-orange-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-orange-500 has-[:checked]:[&_.selection-check]:text-orange-600 dark:has-[:checked]:[&_.selection-check]:text-orange-400'
	},
	blue: {
		iconClass: 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400',
		checkedClass:
			'has-[:checked]:border-blue-400/70 has-[:checked]:bg-blue-500/15 has-[:checked]:[&_.course-icon]:bg-blue-500 has-[:checked]:[&_.course-icon]:text-white has-[:checked]:[&_.selection-check]:border-blue-500 has-[:checked]:[&_.selection-check]:text-blue-600 dark:has-[:checked]:[&_.selection-check]:text-blue-400'
	},
	primary: {
		iconClass: 'bg-primary/10 text-primary',
		checkedClass:
			'has-[:checked]:border-primary/40 has-[:checked]:bg-primary/8 has-[:checked]:[&_.course-icon]:bg-primary has-[:checked]:[&_.course-icon]:text-primary-foreground has-[:checked]:[&_.selection-check]:border-primary has-[:checked]:[&_.selection-check]:text-primary'
	}
};

export type OnboardingCourseGroup = {
	label: string;
	courses: OnboardingCourse[];
};

function iconForCourse(name: string): CourseIcon {
	const course = name.toLowerCase();

	if (course.includes('biology')) return asCourseIcon(LeafIcon);
	if (course.includes('chemistry')) return asCourseIcon(FlaskConicalIcon);
	if (course.includes('physics')) return asCourseIcon(AtomIcon);
	if (course.includes('environmental')) return asCourseIcon(Globe2Icon);
	if (course.includes('calculus') || course.includes('precalculus'))
		return asCourseIcon(CalculatorIcon);
	if (course.includes('statistics')) return asCourseIcon(BarChart3Icon);
	if (course.includes('computer science')) return asCourseIcon(Code2Icon);
	if (course.includes('english')) return asCourseIcon(BookOpenIcon);
	if (course.includes('history') || course.includes('government'))
		return asCourseIcon(LandmarkIcon);
	if (course.includes('psychology')) return asCourseIcon(BrainIcon);
	if (course.includes('human geography')) return asCourseIcon(Globe2Icon);
	if (course.includes('economics')) return asCourseIcon(BarChart3Icon);
	if (course.includes('spanish')) return asCourseIcon(LanguagesIcon);
	if (course.includes('pe')) return asCourseIcon(DumbbellIcon);
	return asCourseIcon(BookOpenIcon);
}

const SUBJECT_DESCRIPTIONS: Record<string, string> = {
	'AP Biology': 'Cells, genetics, evolution, and ecosystems.',
	'AP Chemistry': 'Atomic structure, reactions, and lab reasoning.',
	'AP Physics 1': 'Motion, forces, energy, and waves.',
	'AP Physics 2': 'Fluids, thermodynamics, and modern physics.',
	'AP Physics C: Mechanics': 'Master mechanics, forces, and motion.',
	'AP Physics C: E&M': 'Electricity, magnetism, and circuits.',
	'AP Environmental Science': 'Ecosystems, sustainability, and Earth systems.',
	'AP Calculus AB': 'Limits, derivatives, and integrals.',
	'AP Calculus BC': 'Advanced calculus and series.',
	'AP Statistics': 'Data analysis, probability, and inference.',
	'AP Precalculus': 'Functions, trigonometry, and modeling.',
	'AP Computer Science A': 'Java programming and algorithms.',
	'AP Computer Science Principles': 'Computing concepts and creative development.',
	'AP English Language': 'Rhetoric, argument, and synthesis.',
	'AP English Literature': 'Analyze texts and build strong arguments.',
	'AP US History': 'American history from colonization to present.',
	'AP World History': 'Global civilizations and historical thinking.',
	'AP European History': 'European history and historical analysis.',
	'AP US Government': 'Constitution, institutions, and political processes.',
	'AP Comparative Government': 'Compare political systems worldwide.',
	'AP Psychology': 'Behavior, cognition, and research methods.',
	'AP Human Geography': 'Population, culture, and land use.',
	'AP Macroeconomics': 'Economic principles and real-world applications.',
	'AP Microeconomics': 'Supply, demand, and market behavior.',
	'AP Spanish Language': 'Listening, speaking, and cultural competency.'
};

function descriptionForCourse(name: string): string {
	if (SUBJECT_DESCRIPTIONS[name]) return SUBJECT_DESCRIPTIONS[name];

	const course = name.toLowerCase();
	if (course.includes('biology')) return 'Cells, genetics, evolution, and ecosystems.';
	if (course.includes('chemistry')) return 'Atomic structure, reactions, and lab reasoning.';
	if (course.includes('physics')) return 'Forces, motion, and physical systems.';
	if (course.includes('environmental')) return 'Ecosystems, sustainability, and Earth systems.';
	if (course.includes('calculus')) return 'Limits, derivatives, and integrals.';
	if (course.includes('statistics')) return 'Data analysis, probability, and inference.';
	if (course.includes('precalculus')) return 'Functions, trigonometry, and modeling.';
	if (course.includes('computer science'))
		return 'Programming, algorithms, and computing concepts.';
	if (course.includes('english')) return 'Reading, writing, and critical analysis.';
	if (course.includes('history')) return 'Historical thinking across eras and regions.';
	if (course.includes('government')) return 'Political systems, institutions, and policy.';
	if (course.includes('psychology')) return 'Behavior, cognition, and research methods.';
	if (course.includes('human geography')) return 'Population, culture, and land use.';
	if (course.includes('economics')) return 'Economic principles and real-world applications.';
	if (course.includes('spanish')) return 'Listening, speaking, and cultural competency.';

	return 'Practice questions tailored to your AP course.';
}

function colorForCourse(name: string): CourseColor {
	const course = name.toLowerCase();

	if (course.includes('physics')) return 'sky';
	if (course.includes('biology') || course.includes('environmental')) return 'emerald';
	if (course.includes('chemistry')) return 'violet';
	if (
		course.includes('calculus') ||
		course.includes('precalculus') ||
		course.includes('statistics')
	)
		return 'indigo';
	if (course.includes('computer science')) return 'cyan';
	if (course.includes('english')) return 'purple';
	if (course.includes('history')) return 'amber';
	if (course.includes('government')) return 'teal';
	if (course.includes('psychology') || course.includes('human geography')) return 'rose';
	if (course.includes('economics')) return 'orange';
	if (course.includes('spanish')) return 'blue';

	return 'primary';
}

function themeForCourse(name: string) {
	return COURSE_COLOR_THEMES[colorForCourse(name)];
}

export const onboardingCourses: OnboardingCourse[] = getCourses().map((course) => {
	const theme = themeForCourse(course.name);

	return {
		name: course.name,
		icon: iconForCourse(course.name),
		description: descriptionForCourse(course.name),
		iconClass: theme.iconClass,
		checkedClass: theme.checkedClass
	};
});

const SUBJECT_GROUPS = [
	{ label: 'Math', matches: (name: string) => /calculus|precalculus|statistics/i.test(name) },
	{
		label: 'Science',
		matches: (name: string) => /biology|chemistry|physics|environmental science/i.test(name)
	},
	{ label: 'Computer Science', matches: (name: string) => /computer science/i.test(name) },
	{ label: 'English', matches: (name: string) => /english/i.test(name) },
	{
		label: 'History & Social Science',
		matches: (name: string) => /history|government|psychology|human geography|economics/i.test(name)
	},
	{ label: 'World Languages', matches: (name: string) => /spanish/i.test(name) },
	{ label: 'Other', matches: () => true }
] as const;

export const onboardingCourseGroups: OnboardingCourseGroup[] = SUBJECT_GROUPS.map(
	({ label }, groupIndex) => ({
		label,
		courses: onboardingCourses.filter(
			(course) => SUBJECT_GROUPS.findIndex((group) => group.matches(course.name)) === groupIndex
		)
	})
).filter((group) => group.courses.length > 0);

const courseByName = new Map(onboardingCourses.map((course) => [course.name, course]));

export function getCoursePresentation(name: string): Pick<OnboardingCourse, 'icon' | 'iconClass'> {
	const course = courseByName.get(name);
	if (course) return { icon: course.icon, iconClass: course.iconClass };
	return { icon: asCourseIcon(BookOpenIcon), iconClass: COURSE_COLOR_THEMES.primary.iconClass };
}
