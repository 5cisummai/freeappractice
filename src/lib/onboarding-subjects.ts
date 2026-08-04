import AtomIcon from '@lucide/svelte/icons/atom';
import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
import BookOpenIcon from '@lucide/svelte/icons/book-open';
import BrainIcon from '@lucide/svelte/icons/brain';
import CalculatorIcon from '@lucide/svelte/icons/calculator';
import Code2Icon from '@lucide/svelte/icons/code-2';
import DumbbellIcon from '@lucide/svelte/icons/dumbbell';
import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
import Globe2Icon from '@lucide/svelte/icons/globe-2';
import LandmarkIcon from '@lucide/svelte/icons/landmark';
import LanguagesIcon from '@lucide/svelte/icons/languages';
import LeafIcon from '@lucide/svelte/icons/leaf';
import type { Component } from 'svelte';
import { getCourses } from '$lib/catalog/ap-classes.js';

type SubjectIcon = Component<{ class?: string }>;

export type OnboardingSubject = {
	name: string;
	icon: SubjectIcon;
	description: string;
	iconClass: string;
};

export type OnboardingSubjectGroup = {
	label: string;
	subjects: OnboardingSubject[];
};

function iconForSubject(name: string): SubjectIcon {
	const subject = name.toLowerCase();

	if (subject.includes('biology')) return LeafIcon;
	if (subject.includes('chemistry')) return FlaskConicalIcon;
	if (subject.includes('physics')) return AtomIcon;
	if (subject.includes('environmental')) return Globe2Icon;
	if (subject.includes('calculus') || subject.includes('precalculus')) return CalculatorIcon;
	if (subject.includes('statistics')) return BarChart3Icon;
	if (subject.includes('computer science')) return Code2Icon;
	if (subject.includes('english')) return BookOpenIcon;
	if (subject.includes('history') || subject.includes('government')) return LandmarkIcon;
	if (subject.includes('psychology')) return BrainIcon;
	if (subject.includes('human geography')) return Globe2Icon;
	if (subject.includes('economics')) return BarChart3Icon;
	if (subject.includes('spanish')) return LanguagesIcon;
	if (subject.includes('pe')) return DumbbellIcon;
	if (subject.includes('lunch')) return BookOpenIcon;

	return BookOpenIcon;
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

function descriptionForSubject(name: string): string {
	if (SUBJECT_DESCRIPTIONS[name]) return SUBJECT_DESCRIPTIONS[name];

	const subject = name.toLowerCase();
	if (subject.includes('biology')) return 'Cells, genetics, evolution, and ecosystems.';
	if (subject.includes('chemistry')) return 'Atomic structure, reactions, and lab reasoning.';
	if (subject.includes('physics')) return 'Forces, motion, and physical systems.';
	if (subject.includes('environmental')) return 'Ecosystems, sustainability, and Earth systems.';
	if (subject.includes('calculus')) return 'Limits, derivatives, and integrals.';
	if (subject.includes('statistics')) return 'Data analysis, probability, and inference.';
	if (subject.includes('precalculus')) return 'Functions, trigonometry, and modeling.';
	if (subject.includes('computer science')) return 'Programming, algorithms, and computing concepts.';
	if (subject.includes('english')) return 'Reading, writing, and critical analysis.';
	if (subject.includes('history')) return 'Historical thinking across eras and regions.';
	if (subject.includes('government')) return 'Political systems, institutions, and policy.';
	if (subject.includes('psychology')) return 'Behavior, cognition, and research methods.';
	if (subject.includes('human geography')) return 'Population, culture, and land use.';
	if (subject.includes('economics')) return 'Economic principles and real-world applications.';
	if (subject.includes('spanish')) return 'Listening, speaking, and cultural competency.';

	return 'Practice questions tailored to your AP course.';
}

function iconClassForSubject(name: string): string {
	const subject = name.toLowerCase();

	if (subject.includes('physics'))
		return 'bg-sky-100 text-sky-600 dark:bg-sky-950/80 dark:text-sky-400';
	if (subject.includes('biology') || subject.includes('environmental'))
		return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400';
	if (subject.includes('chemistry'))
		return 'bg-violet-100 text-violet-600 dark:bg-violet-950/80 dark:text-violet-400';
	if (subject.includes('calculus') || subject.includes('precalculus') || subject.includes('statistics'))
		return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400';
	if (subject.includes('computer science'))
		return 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/80 dark:text-cyan-400';
	if (subject.includes('english'))
		return 'bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400';
	if (subject.includes('history'))
		return 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400';
	if (subject.includes('government'))
		return 'bg-teal-100 text-teal-600 dark:bg-teal-950/80 dark:text-teal-400';
	if (subject.includes('psychology') || subject.includes('human geography'))
		return 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400';
	if (subject.includes('economics'))
		return 'bg-orange-100 text-orange-600 dark:bg-orange-950/80 dark:text-orange-400';
	if (subject.includes('spanish'))
		return 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400';

	return 'bg-primary/10 text-primary';
}

export const onboardingSubjects: OnboardingSubject[] = getCourses().map((course) => ({
	name: course.name,
	icon: iconForSubject(course.name),
	description: descriptionForSubject(course.name),
	iconClass: iconClassForSubject(course.name)
}));

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

export const onboardingSubjectGroups: OnboardingSubjectGroup[] = SUBJECT_GROUPS.map(
	({ label }, groupIndex) => ({
		label,
		subjects: onboardingSubjects.filter(
			(subject) => SUBJECT_GROUPS.findIndex((group) => group.matches(subject.name)) === groupIndex
		)
	})
).filter((group) => group.subjects.length > 0);
