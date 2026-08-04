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

export const onboardingSubjects: OnboardingSubject[] = getCourses().map((course) => ({
	name: course.name,
	icon: iconForSubject(course.name)
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
