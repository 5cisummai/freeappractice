import type { UiHintId } from '#lib/client/ui-hints.svelte.js';

export type FirstUseHintContent = {
	title: string;
	description: string;
};

export function getFirstUseHintContent(id: UiHintId): FirstUseHintContent {
	switch (id) {
		case 'dashboard-practice':
			return {
				title: 'Start practicing',
				description: 'Start here. Choose a course and begin practicing.'
			};
		case 'practice-selector':
			return {
				title: 'Pick your course',
				description: 'Choose your AP class first, then pick a unit or task.'
			};
		case 'question-tools':
			return {
				title: 'Question tools',
				description: 'Use skip, report, and other tools from here.'
			};
		case 'tutor-widget':
			return {
				title: 'Meet your Tutor',
				description: 'Ask the Tutor about this question.'
			};
		default: {
			const exhaustive: never = id;
			return exhaustive;
		}
	}
}
